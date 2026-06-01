# Agdangan-e-Leave

Run the local server:

```bash
node backend/server.js
```

Open `http://localhost:3000`.

The app still uses Supabase for its main data. Only manual late-minute credit deduction logs are saved through file handling in `file-data/credit-deduction-logs.txt`.

Folder layout:

- `admin-dashboard/`, `employee-dashboard/`, `credit-computation/`, `login/`: app pages
- `assets/css/`: shared styles
- `assets/js/`: shared browser scripts and Supabase config
- `assets/images/`, `assets/vendor/`: images and third-party browser libraries
- `backend/`: local Node server for file handling
- `database/`: Supabase SQL setup files
- `docs/`: setup notes
- `file-data/`: local text-file deduction logs
