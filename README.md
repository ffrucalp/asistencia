# Asistencia – Filosofía General I · UCALP
Sistema de toma de asistencia por hora para Filosofía General I (Licenciatura en Psicología).

## ¿Qué hace?
- Registra asistencia **por hora** (16 h, 17 h, 18 h, 19 h) en lugar de por clase entera
- **Sincronización en tiempo real**: dos profesores pueden cargar la misma clase a la vez
- Acceso por **URL con token** sin necesidad de login (una URL por comisión)
- Importa alumnos desde **CSV**
- Muestra **porcentaje** de asistencia por alumno (mínimo 75% para promocionar)
- **Exporta** a CSV para entregar a la facultad
- Registra qué profesor estuvo a cargo de cada clase

---

## Instalación paso a paso

### 1. Supabase (base de datos)

1. Entrá a [supabase.com](https://supabase.com) y creá un nuevo proyecto
2. Una vez creado, andá a **SQL Editor → New query**
3. Copiá y pegá el contenido de `schema.sql` y ejecutalo (▶ Run)
4. Verificá que dice `Schema creado correctamente` y los 3 profesores aparecen
5. Guardá las credenciales de **Settings → API**:
   - `Project URL` → va a ser tu `VITE_SUPABASE_URL`
   - `anon public` key → va a ser tu `VITE_SUPABASE_ANON_KEY`

### 2. Clonar y configurar

```bash
# Clonar el repo / copiar los archivos a una carpeta
cd asistencia-filoI

# Instalar dependencias
npm install

# Crear el archivo de variables de entorno
cp .env.example .env
# Editá .env con tus credenciales de Supabase
```

Ejemplo de `.env`:
```
VITE_SUPABASE_URL=https://abcdefghij.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_TOKEN_COM1=com1-filoI-2026
VITE_TOKEN_COM2=com2-filoI-2026
VITE_TOKEN_ADMIN=admin-filoI-2026
```

### 3. Probar localmente

```bash
npm run dev
```
Abrí `http://localhost:5173/?token=com1-filoI-2026`

### 4. Deploy en Cloudflare Pages

```bash
npm run build
```

Luego en **Cloudflare Pages**:
1. Creá un nuevo proyecto → conectá tu repositorio de GitHub, **O** subí la carpeta `dist/` directo
2. Framework: **Vite**
3. Build command: `npm run build`
4. Build output: `dist`
5. En **Settings → Environment variables**, agregá las mismas variables del `.env`

---

## URLs de acceso

Una vez deployado, compartí estos links:

| Quién | URL |
|---|---|
| Joaquín (Com. 1) | `https://tu-app.pages.dev/?token=com1-filoI-2026` |
| Daniel (Com. 2) | `https://tu-app.pages.dev/?token=com2-filoI-2026` |
| Francisco (admin) | `https://tu-app.pages.dev/?token=admin-filoI-2026` |

> Podés cambiar los tokens en `.env` (y en Cloudflare) antes del primer uso.

---

## Importar alumnos (CSV)

El CSV puede tener estas columnas (sin importar mayúsculas ni tildes):

```csv
nombre,dni,comision
García Ana Laura,40123456,1
Pérez Juan,39876543,1
Rodríguez María,41234567,2
```

- `nombre`: requerido
- `dni`: opcional
- `comision`: 1 o 2. Si es una URL de comisión específica y se omite, usa esa comisión por defecto.

---

## Calendario del cuatrimestre

15 clases · 60 horas totales · mínimo 45 horas para promocionar (75%)

| # | Fecha |
|---|---|
| 1 | lunes 16/03/2026 |
| 2 | lunes 23/03/2026 |
| 3 | lunes 30/03/2026 |
| 4 | lunes 06/04/2026 |
| 5 | lunes 13/04/2026 |
| 6 | lunes 20/04/2026 |
| 7 | lunes 27/04/2026 |
| 8 | lunes 04/05/2026 |
| 9 | lunes 11/05/2026 |
| 10 | lunes 18/05/2026 |
| 11 | lunes 25/05/2026 |
| 12 | lunes 01/06/2026 |
| 13 | lunes 08/06/2026 |
| 14 | lunes 15/06/2026 |
| 15 | lunes 22/06/2026 |
| 16 | lunes 29/06/2026 |

> Nota: son 16 lunes entre el 16/3 y el 29/6. Si alguno es feriado o no hay clase, esas horas simplemente quedan sin datos y no afectan el total acumulado del alumno.

---

## Cátedra

- Francisco Fernández Ruiz
- Joaquín Bussi
- Daniel Sabio
