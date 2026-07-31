# CLAUDE.md

## Deployment verification

After pushing to `Staging` or `main` (see [docs/DEPLOY_WORKFLOW.md](docs/DEPLOY_WORKFLOW.md)), always confirm the Vercel deployment actually succeeded before reporting the task done. Don't just assume the push worked — check:

1. **Deployment state**: use the Vercel MCP tools (`list_deployments` / `get_deployment`) to confirm the new deployment's `readyState` is `READY`, on the right branch/target, and at the commit you just pushed.
2. **Build logs**: `get_deployment_build_logs` with `errorsOnly: true` — should show no real errors.
3. **Runtime errors**: `get_runtime_errors` for the project since the deploy — should be empty.
4. **Live spot-check**: hit the actual domain to confirm the change is live —`staging.nooc.io` for Staging, `nooc.io` for production. Don't just check the homepage; hit an API route or page that exercises whatever you just shipped.

Do this for both Staging and main when a change goes through the full `feature → Staging → main` pipeline in one turn.
