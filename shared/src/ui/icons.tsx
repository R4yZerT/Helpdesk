// Íconos Iconify (lucide) via react-native-svg SvgXml — sin emojis
import { SvgXml } from 'react-native-svg';

const EYE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2.062 12.348a1 1 0 0 1 0-.696a10.75 10.75 0 0 1 19.876 0a1 1 0 0 1 0 .696a10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></g></svg>`;
const EYE_OFF = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575a1 1 0 0 1 0 .696a10.8 10.8 0 0 1-1.444 2.49m-6.41-.679a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151a1 1 0 0 1 0-.696a10.75 10.75 0 0 1 4.446-5.143M2 2l20 20"/></g></svg>`;
const LOCK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></g></svg>`;

type P = { size?: number; color?: string };
export function IconEye({ size = 18, color = 'currentColor' }: P) {
  return <SvgXml xml={EYE} width={size} height={size} color={color} />;
}
export function IconEyeOff({ size = 18, color = 'currentColor' }: P) {
  return <SvgXml xml={EYE_OFF} width={size} height={size} color={color} />;
}
export function IconLock({ size = 16, color = 'currentColor' }: P) {
  return <SvgXml xml={LOCK} width={size} height={size} color={color} />;
}
