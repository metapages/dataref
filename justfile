###############################################################
# Minimal commands to develop, build, test, and deploy
###############################################################
# just docs: https://github.com/casey/just
set shell                          := ["bash", "-c"]
set dotenv-load                    := true
set export                         := true
PACKAGE_NAME_SHORT                 := file_name(`cat package.json | jq -r '.name' | sed 's/.*\///'`)
# vite needs an extra memory boost
vite                               := " NODE_OPTIONS='--max_old_space_size=16384' ./node_modules/vite/bin/vite.js"
tsc                                := "./node_modules/typescript/bin/tsc"
# minimal formatting, bold is very useful
bold                               := '\033[1m'
normal                             := '\033[0m'
green                              := "\\e[32m"
yellow                             := "\\e[33m"
blue                               := "\\e[34m"
magenta                            := "\\e[35m"
grey                               := "\\e[90m"

# If not in docker, get inside
_help:
    #!/usr/bin/env bash
    set -euo pipefail
    echo -e ""
    just --list --unsorted --list-heading $'🌱 Commands:\n\n'
    echo -e ""
    echo -e "    Github  URL 🔗 {{green}}$(cat package.json | jq -r '.repository.url'){{normal}}"
    echo -e "    Publish URL 🔗 {{green}}https://$(cat package.json | jq -r '.name' | sd '/.*' '' | sd '@' '').github.io/{{PACKAGE_NAME_SHORT}}/{{normal}}"
    echo -e ""

# Run the dev server. Opens the web app in browser.
dev: _ensure_npm_modules (_tsc "--build")
    #!/usr/bin/env bash
    set -euo pipefail
    npm i
    VITE_APP_ORIGIN=${APP_ORIGIN} {{vite}} --clearScreen false



# Run tests
@test +args="": (_tsc "--build")
    npx vitest {{args}}

# Increment semver version, push the tags (triggers "_on-tag-version")
@publish npmversionargs="patch": _fix_git_actions_permission _ensureGitPorcelain (_npm_version npmversionargs)
    # Push the tags up
    git push origin v$(cat package.json | jq -r '.version')

# Reaction to "publish". On new git version tag: publish code [github pages, cloudflare pages, npm]
_on-tag-version: _fix_git_actions_permission _ensure_npm_modules _ensureGitPorcelain _publish_to_gh-pages

# Build the app for production. Called automatically by "test" and "publish"
build BASE="": _ensure_npm_modules (_tsc "--build")
    mkdir -p dist
    rm -rf dist/*
    # {{tsc}}  src/lib/index.ts --declaration --emitDeclarationOnly --jsx react --esModuleInterop --outDir dist
    {{vite}} build --mode=production
    @# {{tsc}} --noEmit false --project ./tsconfig.npm.json
    @echo "  ✅ npm build"
# Deletes: [ .certs, dist ]
@clean:
    rm -rf dist

# bumps version, commits change, git tags
@_npm_version npmversionargs="patch":
    npm version {{npmversionargs}}
    echo -e "  📦 new version: {{green}}$(cat package.json | jq -r .version){{normal}}"

# compile typescript src, may or may not emit artifacts
_tsc +args="": _ensure_npm_modules
    {{tsc}} {{args}}

@_ensure_npm_modules:
    if [ ! -f "{{tsc}}" ]; then npm i; fi

# vite builder commands
@_vite +args="":
    {{vite}} {{args}}

@_publish_to_gh-pages: _ensure_npm_modules
    deno run --unstable --allow-all https://deno.land/x/metapages@v0.0.24/browser/gh-pages-publish-to-docs.ts --versioning=true

_ensureGitPorcelain:
    #!/usr/bin/env bash
    set -eo pipefail
    # In github actions, we modify .github/actions/cloud/action.yml for reasons
    # so do not do this check there
    if [ "${GITHUB_WORKSPACE}" = "" ]; then
        deno run --allow-all --unstable https://deno.land/x/metapages@v0.0.24/git/git-fail-if-uncommitted-files.ts
    fi

_fix_git_actions_permission:
    #!/usr/bin/env bash
    set -eo pipefail
    # workaround for github actions docker permissions issue
    if [ "${GITHUB_WORKSPACE}" != "" ]; then
        git config --global --add safe.directory /github/workspace
        git config --global --add safe.directory /repo
        git config --global --add safe.directory $(pwd)
        export GIT_CEILING_DIRECTORIES=/__w
    fi
