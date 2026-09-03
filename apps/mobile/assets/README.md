# Assets Login

Pon aquí tu imagen para el Login:

1. Copia tu imagen (PNG/JPG/WEBP) a esta carpeta con el nombre exacto:
   `apps/mobile/assets/login-hero.png`  (o `login-hero.jpg`)

2. Recomendado: 800x600px, PNG con fondo transparente o JPG warm, < 500KB.

3. Reinicia Expo con cache limpio:
   ```bash
   pnpm --filter @helpdesk/shared build
   pnpm --filter mobile exec expo start -c
   ```

LoginScreen ya está preparado para cargarla vía:
```tsx
<Image source={require('../../assets/login-hero.png')} />
```
Si no existe el archivo, comenta esa línea temporalmente.
