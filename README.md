# OBoost Manager

A full-stack operations management system built for OBoost, a company operating automated fresh orange juice machines across malls, train stations, offices, and other public locations.

The system centralizes machine monitoring, cleaning schedules, fault handling, employee tasks, reports, and inventory management in one place.

## Live Website

[https://oboost-portal.netlify.app/](https://oboost-manager.netlify.app/)

## Screenshots

### Overview

![OBoost Manager overview dashboard](docs/screenshots/overview.jpeg)

### Machines

![OBoost Manager machines page](docs/screenshots/machines.jpeg)

### Employees

![OBoost Manager employees page](docs/screenshots/employees.jpeg)

## Business problem

OBoost needed a centralized system to manage the daily operation of its automated fresh orange juice machines across multiple locations.

OBoost Manager replaces separate manual tracking processes with one shared, role-based system for managing cleaning schedules, machine faults, employee assignments, tasks, reports, and inventory.

## Main features

- **Machine tracking** — monitors the cleaning and fault status of every machine across the company’s locations. Cleaning status is calculated according to a fixed 21-day cycle.

- **Cleaning management** — employees can mark machines as cleaned, which updates their status in the database and records the action in a cleaning history log.

- **Fault handling** — authenticated users can report machine malfunctions, including a description, fault type, severity, and optional photo. Managers can clear the fault after it has been repaired.

- **Task management** — managers can create and assign general or cleaning tasks to employees. Completing a cleaning task automatically updates the linked machine’s cleaning status.

- **Inventory tracking** — tracks deliveries and withdrawals of orange cartons and machine spare parts while preventing the recorded stock from falling below zero.

- **Reports** — provides live cleaning, malfunction, inventory, and task history directly from the database.

- **Employee management** — managers can view staff records and add new employees with corresponding Supabase authentication accounts.

## Role model and access control

The application has two roles: **employee** and **manager**.

Managers have access to the full operational system, including the dashboard, machines, employees, reports, tasks, and inventory.

Employees can access their assigned machines, tasks, activity history, inventory, machine details, and malfunction reporting.

Authorization is enforced through PostgreSQL Row Level Security, making the database — rather than only the user interface — responsible for protecting restricted data and actions.

## Technology stack

- React 19
- TypeScript
- Vite
- React Router v7
- Plain CSS
- Supabase PostgreSQL
- Supabase Authentication
- PostgreSQL Row Level Security
- PostgreSQL functions and `pg_cron`

## Architecture

OBoost Manager is a single-page React application organized into reusable pages and components.

Database communication is centralized through a typed Supabase client in `src/lib/supabase.ts`. Authentication, routing, and available application views are determined by the user’s role stored in the `profiles` table.

Database tables, security policies, functions, and migrations are maintained in `backend/migrations/` and applied to the Supabase project.

## Local setup

Install the project dependencies:

```bash
npm install
