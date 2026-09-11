# O-vuoro work-time PWA

Mobile-first work-time tracking app. Development runs entirely in Docker; Node.js and npm are not required on the host computer.

## Development

Install Docker Desktop, then run from this directory:

```text
docker compose up --build
```

Open <http://localhost:5173>. Source files are mounted into the container and Vite reloads the app as files change.

The dependency directory is stored in the Docker volume `o_vuoro_app_node_modules`, not in the workspace.

## Usage

The default expected work duration is configurable in **Settings** and is used for new entries. Each day can override that duration when editing an entry; the day balance and exports use the stored day-specific value. Multiple work periods on the same day share the day's expected duration.

Entries can also include an optional note, which is shown in Today and History and included in backups and CSV exports.

## Checks

Run tests inside the container:

```text
docker compose run --rm app npm test
```

Create a production build inside the container:

```text
docker compose run --rm app npm run build
```

## Android development preview

To test from an Android phone on the same network, use the computer's local network address instead of `localhost`, for example `http://192.168.1.20:5173`. The computer firewall must allow TCP port 5173.

The app includes Today, multiple work periods per day, configurable default and per-day expected durations, notes, history, IndexedDB persistence, date/time editing, deletion, backup/restore, and PWA installation metadata.

## GitHub Pages installation

The live app is published at <https://raulifin.github.io/o_vuoro_app/>.

Create an empty GitHub repository, push this project to its `main` branch, then enable **Settings -> Pages -> GitHub Actions**. The included workflow builds the app inside Docker and publishes it over HTTPS. The repository name is used automatically as the Vite base path.

From this project directory, after creating the repository, run:

```text
git init
git add .
git commit -m "Initial work-time PWA"
git branch -M main
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY.git
git push -u origin main
```

Replace the account and repository placeholders with your GitHub values. The workflow runs automatically after the push.

After the workflow completes, open the displayed Pages URL on Android Chrome and choose **Install app** or **Add to Home screen**. The app stores work-time data in IndexedDB on the phone. The published files are only the installation source; normal use works from the phone's cache and does not require Docker, GitHub, or a network connection.