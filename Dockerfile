FROM docker.io/cloudflare/sandbox:0.12.9

# Cloudflare Sandbox image convention -- documents the port the sandbox
# control plane listens on. We don't expose anything else from the sandbox
# itself; the counter app it builds is deployed out to its own Worker.
EXPOSE 8080
