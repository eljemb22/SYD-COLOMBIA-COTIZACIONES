# SYD Colombia - Software de Cotizaciones y Licitaciones

Sistema web integral de cotizaciones biomédicas, licitaciones públicas, seguimiento de órdenes de compra (OC) y gestión de fichas técnicas con sincronización en tiempo real en la nube.

---

## 🛠️ Requisitos Previos

- **Node.js** v18 o v20+ instalado en tu computador ([Descargar Node.js](https://nodejs.org/))
- **Git** instalado en tu computador ([Descargar Git](https://git-scm.com/))
- Cuenta en [GitHub](https://github.com/)

---

## 💻 Instalación y Ejecución Local con Node.js

Sigue estos 3 pasos para instalar y ejecutar el proyecto en tu máquina:

### 1. Clonar o descargar el proyecto e ingresar a la carpeta:
```bash
git clone https://github.com/TU-USUARIO/syd-colombia.git
cd syd-colombia
```

### 2. Instalar dependencias:
```bash
npm install
```

### 3. Iniciar el servidor de desarrollo:
```bash
npm run dev
```
La aplicación se abrirá en tu navegador en:
👉 **http://localhost:3000**

---

## 🚀 Compilación y Modo Producción

Para compilar la aplicación para producción:

```bash
# Compilar frontend (Vite) y backend (Express)
npm run build

# Iniciar el servidor en producción
npm start
```

---

## 🌐 Cómo Subir el Proyecto a GitHub

Si tienes la carpeta del proyecto en tu computador y quieres subirla a tu cuenta de GitHub:

### 1. Inicializar el repositorio Git local:
```bash
git init
git add .
git commit -m "feat: versión inicial SYD Colombia con Node.js"
```

### 2. Crear el repositorio en GitHub:
1. Entra a [github.com/new](https://github.com/new).
2. Asigna un nombre (por ejemplo: `syd-colombia`).
3. Déjalo como **Público** o **Privado** según prefieras.
4. **No** marques la opción de inicializar con README (ya tienes uno).
5. Haz clic en **Create repository**.

### 3. Vincular y subir tu código:
```bash
git remote add origin https://github.com/TU-USUARIO/syd-colombia.git
git branch -M main
git push -u origin main
```

---

## ☁️ Cómo Desplegar en la Web

### Opción A: Despliegue en Render / Railway / Cloud Run (Full-Stack Recomendado)
Dado que el proyecto cuenta con un servidor Node.js/Express (`server.ts`) para APIs y Vite:
1. Conecta tu repositorio de GitHub en [Render.com](https://render.com) o [Railway.app](https://railway.app).
2. Configura los comandos:
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
   - **Node Version:** `20`
3. Agrega las variables de entorno si utilizas APIs adicionales (ver `.env.example`).

### Opción B: Despliegue en Vercel o Netlify (Frontend SPA)
1. Conecta tu repositorio de GitHub en Vercel o Netlify.
2. Configuración de compilación:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Listo. El frontend se publicará automáticamente con cada `git push`.

---

## 📁 Estructura del Proyecto

```
├── index.html                  # Entrada HTML principal y PWA manifest
├── package.json                # Dependencias y scripts de Node.js
├── server.ts                   # Servidor Express y APIs backend
├── tsconfig.json               # Configuración de TypeScript
├── vite.config.ts              # Configuración de Vite y Tailwind CSS
├── public/                     # Recursos estáticos, logos y catálogo base
│   └── logos/
├── src/
│   ├── main.tsx                # Entrada React 19
│   ├── App.tsx                 # Componente raíz y navegación
│   ├── index.css               # Estilos con Tailwind CSS
│   ├── types.ts                # Tipado TypeScript global
│   ├── components/
│   │   ├── views/              # Vistas principales (Cotizaciones, Licitaciones, OC, etc.)
│   │   ├── modals/             # Diálogos interactivos (Clientes, Sincronización, etc.)
│   │   └── common/             # Componentes reutilizables
│   ├── services/               # Sincronización Firebase en tiempo real
│   └── utils/                  # Funciones de cálculo, TRM, PDF y exportación Excel
```
