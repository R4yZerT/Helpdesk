pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  parameters {
    booleanParam(name: 'DEPLOY_WEB', defaultValue: true, description: 'Construir y levantar web en Docker local (:3000)')
    booleanParam(name: 'PUSH_SUPABASE_DB', defaultValue: false, description: 'Ejecutar supabase db push --linked (requiere SUPABASE_ACCESS_TOKEN)')
    choice(name: 'EAS_BUILD', choices: ['none', 'preview', 'production'], description: 'Build móvil vía EAS (requiere EXPO_TOKEN + eas.json)')
  }

  environment {
    // Jenkins (brew, PATH mínimo) no hereda el PATH del shell: se añade explícito
    PATH = "/Users/yeipezz/.nvm/versions/node/v24.14.1/bin:/Users/yeipezz/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
    COREPACK_ENABLE_DOWNLOAD_PROMPT = '0'
    // Se inyectan vía credenciales Jenkins (ver Jenkinsfile README en Jenkins > credenciales):
    // EXPO_PUBLIC_SUPABASE_URL (secret text: supabase-url)
    // EXPO_PUBLIC_SUPABASE_ANON_KEY (secret text: supabase-anon-key)
    // SUPABASE_ACCESS_TOKEN (secret text: supabase-access-token, solo si PUSH_SUPABASE_DB)
    // EXPO_TOKEN (secret text: expo-token, solo si EAS_BUILD != none)
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Toolchain') {
      steps {
        sh '''
          set -e
          node --version
          corepack enable || true
          corepack prepare pnpm@9.0.0 --activate
          pnpm --version
          docker --version
        '''
      }
    }

    stage('Install') {
      steps {
        withCredentials([
          string(credentialsId: 'supabase-url', variable: 'EXPO_PUBLIC_SUPABASE_URL'),
          string(credentialsId: 'supabase-anon-key', variable: 'EXPO_PUBLIC_SUPABASE_ANON_KEY')
        ]) {
          sh '''
            set -e
            pnpm install --frozen-lockfile
          '''
        }
      }
    }

    stage('Build shared') {
      steps { sh 'pnpm --filter @helpdesk/shared build' }
    }

    stage('Typecheck') {
      steps { sh 'pnpm typecheck' }
    }

    stage('Test') {
      steps { sh 'pnpm --filter @helpdesk/shared test' }
      post {
        always {
          junit allowEmptyResults: true, testResults: '**/junit*.xml'
        }
      }
    }

    stage('Supabase DB push (opt-in)') {
      when { expression { return params.PUSH_SUPABASE_DB } }
      steps {
        withCredentials([string(credentialsId: 'supabase-access-token', variable: 'SUPABASE_ACCESS_TOKEN')]) {
          sh '''
            set -e
            npx supabase --version
            npx supabase db push --linked
          '''
        }
      }
    }

    stage('Docker build + deploy web') {
      when { expression { return params.DEPLOY_WEB } }
      steps {
        withCredentials([
          string(credentialsId: 'supabase-url', variable: 'EXPO_PUBLIC_SUPABASE_URL'),
          string(credentialsId: 'supabase-anon-key', variable: 'EXPO_PUBLIC_SUPABASE_ANON_KEY')
        ]) {
          sh '''
            set -e
            docker compose build web
            docker compose up -d web
            echo "Esperando healthcheck :3000 ..."
            for i in $(seq 1 24); do
              code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/ || true)
              if [ "$code" = "200" ]; then echo "web OK (200)"; break; fi
              echo "intento $i: http=$code, reintentando..."
              sleep 5
              if [ "$i" = "24" ]; then echo "ERROR: web no respondió 200"; docker compose logs web --tail 50; exit 1; fi
            done
            docker ps --filter name=helpdesk-web --format "{{.Names}} {{.Status}} {{.Ports}}"
          '''
        }
      }
    }

    stage('EAS build (opt-in)') {
      when { expression { return params.EAS_BUILD != 'none' } }
      steps {
        withCredentials([string(credentialsId: 'expo-token', variable: 'EXPO_TOKEN')]) {
          sh '''
            set -e
            npm i -g eas-cli
            eas --version
            cd apps/mobile
            eas build --platform all --profile ${EAS_BUILD} --non-interactive --no-wait
          '''
        }
      }
    }
  }

  post {
    success { echo 'Pipeline OK — typecheck + tests + docker web verde.' }
    failure {
      echo 'Pipeline FALLÓ — revisa la etapa en rojo.'
      sh 'docker compose logs web --tail 50 || true'
    }
  }
}
