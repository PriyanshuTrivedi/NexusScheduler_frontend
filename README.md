# Nexus Scheduler Web

React frontend for Nexus Scheduler.

## Local development

```bash
npm install
npm start
```

For the existing nodemon-based development command:

```bash
npm run dev
```

The frontend expects the API gateway at:

```text
REACT_APP_API_BASE_URL=http://localhost:8080/api/v1
```

## Main flows

- Client login/register
- Resource provider login/register
- Individual provider registration
- Organization provider registration using an existing organization
- Human-friendly resource search
- Public resource profiles
- Calendar-style availability and booking
- Upcoming and previous bookings
- Resource creation for providers

## Component structure

Components keep their JavaScript and CSS together, for example:

```text
src/components/SearchTree/SearchTree.js
src/components/SearchTree/SearchTree.css
```

Page-specific styles also live beside their page implementation. `src/index.css` contains only global design tokens and shared primitives.
