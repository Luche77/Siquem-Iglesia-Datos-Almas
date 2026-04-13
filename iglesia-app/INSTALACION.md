# Guía de Instalación — Sistema de Visitas Iglesia

## ¿Qué vas a hacer?
1. Crear una base de datos gratuita en Firebase (Google) — 10 minutos
2. Subir la app a internet gratis en Netlify — 5 minutos
3. Compartir el link con los encargados para que la instalen en el celular

---

## PASO 1 — Crear proyecto en Firebase

1. Andá a https://console.firebase.google.com
2. Hacé clic en **"Agregar proyecto"**
3. Nombre del proyecto: `visitas-iglesia` (o el que quieras)
4. Desactivá Google Analytics (no es necesario) → clic en **Crear proyecto**
5. Esperá que termine y hacé clic en **Continuar**

### 1.1 — Crear la base de datos Firestore

1. En el menú izquierdo, hacé clic en **"Firestore Database"**
2. Clic en **"Crear base de datos"**
3. Seleccioná **"Iniciar en modo de prueba"** → Siguiente
4. Elegí la ubicación más cercana (ej: `southamerica-east1` para Argentina) → Listo

### 1.2 — Obtener las credenciales de la app

1. En el menú izquierdo, hacé clic en el ícono de engranaje ⚙️ → **"Configuración del proyecto"**
2. Bajá hasta la sección **"Tus apps"**
3. Hacé clic en el ícono **`</>`** (Web)
4. Nombre de la app: `visitas-web` → Registrar app
5. Va a aparecer un bloque de código. Copiá los valores de:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

### 1.3 — Pegar las credenciales en la app

Abrí el archivo `app.js` y reemplazá el bloque `firebaseConfig`:

```javascript
const firebaseConfig = {
  apiKey: "PEGAR_AQUI",
  authDomain: "PEGAR_AQUI",
  projectId: "PEGAR_AQUI",
  storageBucket: "PEGAR_AQUI",
  messagingSenderId: "PEGAR_AQUI",
  appId: "PEGAR_AQUI"
};
```

### 1.4 — Configurar reglas de Firestore

1. En Firebase, andá a **Firestore Database → Reglas**
2. Reemplazá todo el contenido con esto:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

3. Hacé clic en **Publicar**

> ⚠️ Estas reglas son para uso interno. Para mayor seguridad en el futuro,
> se pueden agregar autenticación más robusta.

---

## PASO 2 — Agregar íconos (opcional pero recomendado)

Creá una carpeta `icons/` dentro del proyecto y agregá dos imágenes:
- `icon-192.png` (192×192 píxeles)
- `icon-512.png` (512×512 píxeles)

Pueden ser el logo de la iglesia. Si no tenés, la app funciona igual pero
sin ícono personalizado al instalarla.

---

## PASO 3 — Subir la app a Netlify (gratis)

1. Andá a https://www.netlify.com y creá una cuenta gratis
2. En el Dashboard, hacé clic en **"Add new site" → "Deploy manually"**
3. Arrastrá la carpeta completa del proyecto a la zona que dice "Drag and drop"
4. Netlify te da un link como `https://random-name.netlify.app`
5. Podés cambiarlo en **Site settings → Change site name**
   Ejemplo: `https://visitas-iglesia.netlify.app`

---

## PASO 4 — Compartir con los encargados

Mandales el link por WhatsApp. Para instalarla en el celular:

### En Android:
1. Abrir el link en Chrome
2. Tocar los tres puntos ⋮ del navegador
3. "Agregar a pantalla de inicio"
4. La app aparece como ícono en el celular

### En iPhone:
1. Abrir el link en Safari (no Chrome)
2. Tocar el ícono de compartir □↑
3. "Agregar a pantalla de inicio"
4. La app aparece como ícono en el celular

---

## PASO 5 — Primer acceso y configuración

### Usuario administrador por defecto:
- **Usuario:** `admin`
- **Contraseña:** `admin123`

> ⚠️ Recomendamos cambiar esto en el código (`app.js`, línea del admin hardcodeado)
> o crear un usuario admin real en Firebase lo antes posible.

### Crear los encargados:
1. Entrá con el usuario admin
2. Ir a la pestaña **"Equipo"**
3. Agregar cada encargado con su nombre, usuario, contraseña y categoría

---

## Estructura de categorías

| Categoría | Género | Edad |
|-----------|--------|------|
| Mujeres jóvenes | Mujer | Hasta 35 años |
| Mujeres adultas | Mujer | 36 años o más |
| Varones jóvenes | Varón | Hasta 35 años |
| Varones adultos | Varón | 36 años o más |

La asignación automática elige al encargado de la categoría correcta
que tenga **menos personas asignadas** (rotación equitativa).

---

## Cómo funciona el WhatsApp automático

Cuando un administrador registra una nueva visita:
1. El sistema asigna automáticamente un encargado
2. El encargado recibe una **notificación** en la app (campanita 🔔)
3. Desde la notificación puede tocar **"Enviar WhatsApp de bienvenida"**
4. Esto abre WhatsApp con el mensaje ya escrito y el número de la persona

> El mensaje está pre-armado pero el encargado lo puede editar antes de enviar.

---

## Costos

| Servicio | Plan | Costo |
|----------|------|-------|
| Firebase Firestore | Spark (gratuito) | $0 — hasta 1GB y 50.000 lecturas/día |
| Netlify | Free | $0 — suficiente para este uso |

Para una iglesia con 10-15 encargados y decenas de visitas por mes,
el plan gratuito de Firebase es más que suficiente.

---

## Soporte

Si algo no funciona, revisá:
1. Que las credenciales de Firebase estén bien pegadas en `app.js`
2. Que las reglas de Firestore estén publicadas
3. Que estés abriendo el link en Chrome (Android) o Safari (iPhone)
