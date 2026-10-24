# Keysy internal wiki

Internal developer documentation for the Keysy monorepo, built with Mintlify. Site configuration lives in
`docs.json`; pages are MDX files.

## Local preview

Install Node.js 20.17.0 or later and the [Mintlify CLI](https://www.mintlify.com/docs/cli/install):

```bash
npm install -g mint
```

From this directory, run:

```bash
mint dev
```

Open `http://localhost:3000`.

## Validate changes

```bash
mint validate
mint broken-links --check-anchors
```

## Publishing

To configure Git-connected publishing, select the `brojyf/keysy` repository,
`main` branch, and `wiki/` directory in the Mintlify dashboard. Merge reviewed
changes through pull requests.

Hosting and custom domains require separate deployment configuration; these
files alone do not publish the site.
