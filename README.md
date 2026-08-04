# OBoost Manager

## Live Website

https://oboost-portal.netlify.app/

## Screenshots

### Overview

![OBoost Manager overview dashboard](docs/screenshots/overview.jpeg)

### Machines

![OBoost Manager machines page](docs/screenshots/machines.jpeg)

### Employees

![OBoost Manager employees page](docs/screenshots/employees.jpeg)

---

## Overview

An internal operations management system for managing fresh orange juice vending machines across multiple locations.

The system centralizes machine operations, employee management, cleaning schedules, fault reporting, inventory tracking, task management, and operational reporting in a single application backed by a PostgreSQL database.

**Related project:** OBoost Marketing Website — the company's public-facing marketing website.

---

## Business problem

OBoost operates fresh orange juice vending machines across multiple locations, with no centralized system to manage daily operations.

OBoost Manager replaces manual tracking with a single role-based platform for managing machines, employees, inventory, cleaning schedules, tasks, and faults.

---

## Main features

- Machine tracking with cleaning and fault status
- Fault reporting and repair workflow
- Employee and task management
- Inventory tracking for orange cartons and spare parts
- Operational reports and history
- Authentication and role-based access control

---

## Role model and access control

The application supports two roles:

- Employee
- Manager

Managers have full operational access, while employees have access only to the functionality required for their daily work.

Authorization is enforced in PostgreSQL using Supabase Row Level Security (RLS), making the database the source of truth rather than the frontend.

---

## Technology stack

- React 19
- TypeScript
- Vite
- React Router v7
- Supabase (PostgreSQL, Auth, Row Level Security, pg_cron)
- Plain CSS

---

## Architecture

A React single-page application with page-based routing and typed Supabase integration.

Database access is centralized through a single typed Supabase client, while the schema, security policies, RPCs, and scheduled jobs are maintained as SQL migrations.

---

## Local setup

```bash
npm install
```

```bash
cp .env.example .env.local
```

Fill in your Supabase project's URL and anon key in `.env.local`, execute the SQL migrations from `backend/migrations`, then run:

```bash
npm run dev
```

---

## Deployment

Deployed on Netlify using `npm run build`, with SPA routing configured through `public/_redirects`.
