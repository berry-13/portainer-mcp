/**
 * Extracts key fields from a Docker container list entry for concise display.
 * @param c - Raw container object from the Docker API
 * @returns Summarized container with Id (truncated), Names, Image, State, Status, Created, Ports, Labels
 */
export function summarizeContainer(c: Record<string, unknown>): Record<string, unknown> {
  return {
    Id: typeof c.Id === "string" ? c.Id.slice(0, 12) : c.Id,
    Names: c.Names,
    Image: c.Image,
    State: c.State,
    Status: c.Status,
    Created: c.Created,
    Ports: c.Ports,
    Labels: c.Labels,
  };
}

/**
 * Extracts key fields from a Docker container inspect response for concise display.
 * Includes state, config, networking, and mount information.
 * @param c - Raw container inspect object from the Docker API
 * @returns Summarized container with state, image, env, cmd, labels, ports, mounts, and restart policy
 */
export function summarizeContainerInspect(c: Record<string, unknown>): Record<string, unknown> {
  const state = c.State as Record<string, unknown> | undefined;
  const config = c.Config as Record<string, unknown> | undefined;
  const networkSettings = c.NetworkSettings as Record<string, unknown> | undefined;
  const hostConfig = c.HostConfig as Record<string, unknown> | undefined;
  return {
    Id: typeof c.Id === "string" ? c.Id.slice(0, 12) : c.Id,
    Name: c.Name,
    State: state ? { Status: state.Status, Running: state.Running, StartedAt: state.StartedAt, FinishedAt: state.FinishedAt, ExitCode: state.ExitCode } : undefined,
    Image: config?.Image,
    Env: config?.Env,
    Cmd: config?.Cmd,
    Labels: config?.Labels,
    Ports: networkSettings?.Ports,
    Mounts: c.Mounts,
    RestartPolicy: hostConfig?.RestartPolicy,
    Created: c.Created,
    Platform: c.Platform,
  };
}

/**
 * Extracts key fields from a Docker image list entry for concise display.
 * @param img - Raw image object from the Docker API
 * @returns Summarized image with Id (truncated), RepoTags, RepoDigests, Created, Size, Labels
 */
export function summarizeImage(img: Record<string, unknown>): Record<string, unknown> {
  return {
    Id: typeof img.Id === "string" ? img.Id.slice(0, 19) : img.Id,
    RepoTags: img.RepoTags,
    RepoDigests: img.RepoDigests,
    Created: img.Created,
    Size: img.Size,
    Labels: img.Labels,
  };
}

/**
 * Extracts key fields from a Docker image inspect response for concise display.
 * Includes architecture, OS, config, and authorship information.
 * @param img - Raw image inspect object from the Docker API
 * @returns Summarized image with architecture, OS, env, cmd, exposed ports, labels, and volumes
 */
export function summarizeImageInspect(img: Record<string, unknown>): Record<string, unknown> {
  const config = img.Config as Record<string, unknown> | undefined;
  return {
    Id: typeof img.Id === "string" ? img.Id.slice(0, 19) : img.Id,
    RepoTags: img.RepoTags,
    RepoDigests: img.RepoDigests,
    Created: img.Created,
    Size: img.Size,
    Architecture: img.Architecture,
    Os: img.Os,
    Author: img.Author,
    Env: config?.Env,
    Cmd: config?.Cmd,
    ExposedPorts: config?.ExposedPorts,
    Labels: config?.Labels,
    Volumes: config?.Volumes,
  };
}
