# INTO INFO — Onboarding & Policies

Internal documentation for INTO INFO SDN BHD, hosted on GitHub Pages.

## Documents

- [`ONBOARDING.md`](./ONBOARDING.md) — Developer Onboarding Guide
- [`HANDBOOK.md`](./HANDBOOK.md) — Company Handbook (all employees)
- [`DEVELOPER_POLICY.md`](./DEVELOPER_POLICY.md) — Developer Policy Handbook

## Local Development

```bash
gem install bundler jekyll
bundle install
bundle exec jekyll serve
```

Site runs at `http://localhost:4000`.

## GitHub Pages

1. Push to the `main` branch.
2. Repo **Settings → Pages** → Source: **Deploy from a branch** → `main` / `(root)`.
3. Site URL: `https://<org-or-username>.github.io/<repo-name>` (visible to org members only for private repos).

> **Note:** Private repos require GitHub Pro/Team/Enterprise for GitHub Pages access. Ensure org members have access to the repo.