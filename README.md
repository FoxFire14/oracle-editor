# Oracle Editor

A desktop SQL editor for Oracle and PostgreSQL databases, built with Java + Electron.

## Requirements

| Tool | Version | Purpose |
|------|---------|---------|
| Java JDK | 17+ | Backend |
| Maven | 3.8+ | Build backend |
| Node.js | 18+ | Frontend |
| npm | 9+ | Frontend dependencies |

---

## Run locally (development)

### 1. Install dependencies

```bash
# Frontend
cd frontend
npm install
```

### 2. Start the app

```bash
# From the frontend/ directory
npm run dev
```

This command does everything automatically:
- Compiles and starts the Java backend
- Starts the Electron + Vite frontend
- Opens the app window

> The first run may take a few seconds while Maven downloads dependencies.

---

## Run tests

### Backend (JUnit 5 + Mockito)

```bash
cd backend
mvn test
```

### Frontend (Vitest)

```bash
cd frontend
npm test
```

---

## Build a distributable executable

### 1. Build the Java backend JAR

```bash
cd backend
mvn package -DskipTests
```

This produces `backend/target/oracle-editor-backend-1.0.0.jar`.

### 2. Build the frontend

```bash
cd frontend
npm run build
```

### 3. Package the app

```bash
# macOS (.dmg)
npm run package

# Windows (.exe — can be built from macOS too)
npx electron-builder --win --publish never

# Linux (.AppImage)
npx electron-builder --linux --publish never
```

Output files are written to `frontend/release/`:

| File | Platform |
|------|----------|
| `Oracle Editor-x.x.x-arm64.dmg` | macOS (Apple Silicon) |
| `Oracle Editor Setup x.x.x.exe` | Windows (x64 + arm64) |
| `Oracle Editor-x.x.x.AppImage` | Linux |

### Installing

- **macOS**: Open the `.dmg`, drag Oracle Editor to Applications. On first launch, right-click → Open if macOS blocks it (no code signing certificate).
- **Windows**: Run the `.exe` installer. It installs the app and creates a Start Menu shortcut.
- **Linux**: Make the `.AppImage` executable (`chmod +x`) and run it directly.

---

## Project structure

```
oracle_editor/
├── backend/          Java 17 / Javalin HTTP server
│   └── src/
│       ├── main/java/com/oracleeditor/
│       │   ├── dialect/      Oracle + PostgreSQL dialect abstractions
│       │   ├── db/           Connection management, query execution
│       │   ├── model/        Data models
│       │   └── routes/       HTTP API endpoints
│       └── test/             JUnit 5 tests
└── frontend/         Electron + React + Vite
    └── src/renderer/src/
        ├── components/       UI components
        ├── store/            Zustand state
        ├── api/              Backend HTTP client
        └── types/            TypeScript types
```
