# Pompeii Food and Drink Research - Survey Data Webapp

A React/Vite web application for browsing archaeological survey data from Pompeii food and drink research.

## Features

- 📊 Browse all archaeological survey features from Pompeii
- 🔍 Search by sheet number, location, or description
- 📍 Location information (Region, Insula, Entrance)
- 📝 Detailed descriptions and relationships
- 📷 Photo galleries with external image loading
- 📚 Archive information for physical records

## Setup

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone or download this repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure the photo link environment variable:

   - Copy `.env.example` to `.env`
   - Set `VITE_PHOTO_LINK` to your photo server URL

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set:

   ```
   VITE_PHOTO_LINK=https://your-photo-server.com/images/
   ```

4. Ensure `features.json` is in the `public` folder

### Running the Application

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173/`

### Building for Production

Build the application:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Data Structure

The application expects `features.json` in the `public` folder with the following structure:

```json
[
  {
    "FEATURE_ID": "16781",
    "SHEET": "6083",
    "SHEET_DATE": "2011-06-30 00:00:00.000",
    "RECORDER_ID": "Linda Baxter",
    "RESEARCHER_ID": "Sera Baker",
    "SEASON": "2011",
    "REGION": "VI",
    "INSULA": "2",
    "ENTRANCE": "6",
    "STRUCTURE_ID": null,
    "SHEET_TYPE_ID": "Feature",
    "SPACE_NUMBER": "Preparation room",
    "DESCRIPTION": "...",
    "CONTIGUOUS_RELATIONSHIP": "...",
    "photos": ["photo1.jpg", "photo2.gif"],
    ...
  }
]
```

## Component Structure

### App.jsx

Main application component that:

- Loads feature data from `features.json`
- Provides search functionality
- Renders the list of features

### FeatureCard.jsx

Individual feature display component with sections for:

- **Location & Header**: Sheet number, Region, Insula, Entrance, Recorder, Researcher
- **Details**: Structure, Sheet Type, Space, Feature Type, Category, etc.
- **Description**: Full text description
- **Contiguous Relationship**: Spatial relationships with other features
- **Photos**: Image gallery (loaded from external server)
- **Archive Information**: Physical archive references (rolls, files, etc.)

## Environment Variables

| Variable          | Description               | Example                       |
| ----------------- | ------------------------- | ----------------------------- |
| `VITE_PHOTO_LINK` | Base URL for photo images | `https://photos.example.com/` |

## Customization

### Styling

- `src/App.css` - Main application styles
- `src/components/FeatureCard.css` - Feature card styles
- `src/index.css` - Global styles

### Colors

The app uses an archaeological theme with brown/terra cotta colors:

- Primary: `#8b4513` (Saddle Brown)
- Secondary: `#d4a574` (Tan)
- Accents: `#a0522d` (Sienna)

## Technologies Used

- **React 19** - UI library
- **Vite** - Build tool and dev server
- **CSS3** - Styling with CSS Grid and Flexbox
- **ESLint** - Code linting

## License

[Add your license information here]

## Contact

[Add your contact information here]
