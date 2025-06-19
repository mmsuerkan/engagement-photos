/# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production (runs TypeScript check first)
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Architecture Overview

This is a React engagement photo sharing application built with Vite and TypeScript. The app allows users to upload and view photos in real-time through Firebase integration.

### Core Components

- **App.tsx**: Main application component handling photo upload, display, and deletion
- **firebase.ts**: Firebase configuration and service exports (Storage + Firestore)

### Key Architecture Patterns

- **Real-time Data**: Uses Firestore `onSnapshot` for live photo gallery updates
- **File Storage**: Firebase Storage for photo uploads with organized folder structure (`photos/`)
- **Data Flow**: 
  - Upload: File → Firebase Storage → Get download URL → Save metadata to Firestore
  - Delete: Remove from both Firestore and Storage simultaneously
- **State Management**: React hooks for upload/delete states and photo collection

### Firebase Integration

- **Storage**: Photos stored in `photos/` folder with timestamp-prefixed filenames
- **Firestore**: Photo metadata stored in `photos` collection with fields:
  - `fileName`: Original file name
  - `downloadURL`: Storage download URL
  - `uploadedAt`: Upload timestamp
  - `storagePath`: Storage reference path for deletion

### Styling

- CSS-based styling with mobile-responsive grid layout
- Animation delays for staggered photo loading
- Custom upload button and photo overlay interactions

## Turkish Language

This application uses Turkish language throughout the UI and user-facing text.