# Admin Ops Architecture

## Purpose

This repository hosts the internal admin operations platform for Centmond. It is built in place on the current Next.js + React + TypeScript + Tailwind + Supabase stack.

The goal is not to run a second product surface. The goal is to provide secure internal operations tooling for:

- user lifecycle management
- admin access management
- subscriptions and finance operations
- review, support, and moderation workflows
- auditability and operational traceability

## Route Spine

The current route structure stays centered on `app/(admin)`:

- `/dashboard`
- `/admin/users`
- `/admin/admins`
- `/admin/subscriptions`
- `/admin/finance`
- `/admin/reviews`
- `/admin/search`
- `/admin/segments`
- `/admin/audit-logs`
- `/admin/activity-logs`
- `/admin/exports`
- `/admin/feature-flags`
- `/admin/internal-settings`
- `/admin/settings`

Redirect shells still present:

- `/admin/orders`
- `/admin/content`

These should remain clearly non-primary until backed by real list/detail flows.

## Main Layers

- `app/`: pages, server actions, API routes
- `components/`: UI building blocks and admin module components
- `lib/admin/*`: auth, permissions, audit, mutation wrappers, services, schemas
- `supabase/migrations/*`: schema evolution
- `docs/*`: maintainer-facing architecture, operations, security, and roadmap docs

## Enforcement Model

- middleware is not the only gate
- every sensitive action validates session server-side
- every sensitive action enforces permission server-side
- high-risk actions can require recent re-auth
- critical audit writes are fail-closed

## Information Architecture

- Overview: dashboard, search
- Operations: users, segments, reviews
- Revenue: subscriptions, finance
- Security: admins, audit logs, activity logs
- Configuration: settings, exports, feature flags, internal settings
