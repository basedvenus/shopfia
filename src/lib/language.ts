export const LANGUAGES=['en','es'] as const;
export type Language=typeof LANGUAGES[number];
export const LANGUAGE_COOKIE='shopfia-language';
export function normalizeLanguage(value:unknown):Language{return value==='es'?'es':'en';}
export function validLanguage(value:unknown):value is Language{return value==='en'||value==='es';}
const spanish:Record<string,string>={
 'Creating...':'Creando…','Signing in...':'Iniciando sesión…','Explore':'Explorar','Parties':'Fiestas','Categories':'Categorías','Favorites':'Favoritos','Messages':'Mensajes','Notifications':'Notificaciones','Settings':'Configuración','My Profile':'Mi perfil','My Parties':'Mis fiestas','Vendor Dashboard':'Panel de negocio','Sign in':'Iniciar sesión','Sign out':'Cerrar sesión','Create account':'Crear cuenta','Sign in with Google':'Continuar con Google','Email':'Correo electrónico','Password':'Contraseña','Forgot password?':'¿Olvidaste tu contraseña?','Preferred language':'Idioma preferido','Save language':'Guardar idioma','Saving…':'Guardando…','Language saved.':'Idioma guardado.','Choose the language you prefer. You can change it anytime in Settings.':'Elige tu idioma preferido. Puedes cambiarlo cuando quieras en Configuración.','Your preference is saved to your account and remembered when you sign in on another device.':'Tu preferencia se guarda en tu cuenta y se recuerda al iniciar sesión en otro dispositivo.','Skip to main content':'Ir al contenido principal','Pet Party':'Fiesta para mascotas',
 'Save profile':'Guardar perfil','Edit profile':'Editar perfil','Display name':'Nombre para mostrar','Username':'Nombre de usuario','Optional photo':'Foto opcional','Profile photo':'Foto de perfil','Profile picture':'Foto de perfil','Sign in to ShopFia':'Iniciar sesión en ShopFia','Continue':'Continuar','Save and continue':'Guardar y continuar'
};
export function translate(language:Language,text:string){return language==='es'?(spanish[text]??text):text;}
