# figma

## figma comments

List and post comments on Figma files.

### figma comments list

List all comments on a Figma file.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fileKey` | `string` | yes | Figma file key (from the file URL) |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `FIGMA_API_KEY` | `string` | yes |  | Figma personal access token |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--format` | `string` | `json` | Output format: json or table |

#### Output

Type: `unknown`

#### Examples

```sh
# List comments as JSON
figma comments list abc123 --format json

# List comments as table
figma comments list abc123 --format table
```

### figma comments post

Post a comment on a Figma file.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fileKey` | `string` | yes | Figma file key (from the file URL) |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `FIGMA_API_KEY` | `string` | yes |  | Figma personal access token |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--message` | `string` |  | Comment text (required) |
| `--node-id` | `string` |  | Pin comment to a specific node ID |

#### Output

Type: `unknown`

#### Examples

```sh
# Post a general comment
figma comments post abc123 --message Looks good!

# Post a comment pinned to a node
figma comments post abc123 --message Check this spacing --node-id 1:42
```

## figma components

List and inspect published Figma components.

### figma components get

Get details for a specific published component.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fileKey` | `string` | yes | Figma file key |
| `componentKey` | `string` | yes | Component key |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `FIGMA_API_KEY` | `string` | yes |  | Figma personal access token |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|


#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | `string` | yes |  |
| `name` | `string` | yes |  |
| `description` | `string` | yes |  |
| `found` | `boolean` | yes |  |

#### Examples

```sh
# Get details for a specific component
figma components get abc123FileKey comp:456
```

### figma components list

List published components in a Figma file.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fileKey` | `string` | yes | Figma file key |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `FIGMA_API_KEY` | `string` | yes |  | Figma personal access token |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|


#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `components` | `array` | yes |  |
| `components[].key` | `string` | yes |  |
| `components[].name` | `string` | yes |  |
| `components[].description` | `string` | yes |  |
| `total` | `number` | yes |  |

#### Examples

```sh
# List all published components
figma components list abc123FileKey
```

## figma files

Query Figma file metadata.

### figma files get

Get metadata for a Figma file.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fileKey` | `string` | yes | Figma file key (from the file URL) |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `FIGMA_API_KEY` | `string` | yes |  | Figma personal access token |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--format` | `string` | `json` | Output format: json or table |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | yes |  |
| `lastModified` | `string` | yes |  |
| `version` | `string` | yes |  |
| `thumbnailUrl` | `string` | no |  |
| `pages` | `array` | yes |  |
| `pages[].id` | `string` | yes |  |
| `pages[].name` | `string` | yes |  |

#### Examples

```sh
# Get file metadata for a Figma file
figma files get abc123XYZ
```

### figma files list

List files in a Figma project.

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `FIGMA_API_KEY` | `string` | yes |  | Figma personal access token |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--project-id` | `string` |  | Figma project ID |
| `--format` | `string` | `json` | Output format: json or table |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectName` | `string` | yes |  |
| `files` | `array` | yes |  |
| `files[].key` | `string` | yes |  |
| `files[].name` | `string` | yes |  |
| `files[].lastModified` | `string` | yes |  |
| `files[].thumbnailUrl` | `string` | no |  |
| `count` | `number` | yes |  |

#### Examples

```sh
# List files in a Figma project
figma files list --project-id 12345
```

## figma frames

Export frame metadata and render frame images from Figma files.

### figma frames export

List all top-level frames in a Figma file.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fileKey` | `string` | yes | Figma file key (from the file URL) |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `FIGMA_API_KEY` | `string` | yes |  | Figma personal access token |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--page` | `string` |  | Filter to frames on a specific page |
| `--format` | `string` | `json` | Output format: json or table |

#### Output

Type: `unknown`

#### Examples

```sh
# List frames in a file
figma frames export abc123 --format json

# List frames on the Home page
figma frames export abc123 --page Home --format table
```

### figma frames render

Download rendered images of specific frames from a Figma file.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fileKey` | `string` | yes | Figma file key (from the file URL) |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `FIGMA_API_KEY` | `string` | yes |  | Figma personal access token |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--ids` | `string` |  | Comma-separated node IDs to render |
| `--image-format` | `string` | `png` | Image format: png or svg (default: png) |
| `--scale` | `number` | `2` | Image scale 1-4 (default: 2) |
| `--output` | `string` | `.` | Output directory (default: current directory) |

#### Output

Type: `unknown`

#### Examples

```sh
# Render frames as 2x PNG
figma frames render abc123 --ids 1:2,3:4 --image-format png --scale 2 --output .
```

## figma nodes

Inspect Figma file nodes.

### figma nodes get

Get details for a specific node in a Figma file.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fileKey` | `string` | yes | Figma file key (from the file URL) |
| `nodeId` | `string` | yes | Node ID (e.g. "1:2") |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `FIGMA_API_KEY` | `string` | yes |  | Figma personal access token |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--depth` | `number` | `1` | How deep into the node tree to display children (default: 1) |
| `--format` | `string` | `json` | Output format: json or table |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | yes |  |
| `name` | `string` | yes |  |
| `type` | `string` | yes |  |
| `boundingBox` | `object` | no |  |
| `boundingBox.x` | `number` | yes |  |
| `boundingBox.y` | `number` | yes |  |
| `boundingBox.width` | `number` | yes |  |
| `boundingBox.height` | `number` | yes |  |
| `children` | `array` | yes |  |
| `children[].id` | `string` | yes |  |
| `children[].name` | `string` | yes |  |
| `children[].type` | `string` | yes |  |
| `childCount` | `number` | yes |  |

#### Examples

```sh
# Inspect a node with 2 levels of children
figma nodes get abc123XYZ 1:2 --depth 2
```

## figma tokens

Extract design tokens from Figma files.

### figma tokens export

Extract design tokens from a Figma file.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fileKey` | `string` | yes | Figma file key |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `FIGMA_API_KEY` | `string` | yes |  | Figma personal access token |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--format` | `string` | `dtcg` | Output format: dtcg (W3C DTCG), flat (key-value), json (raw intermediate) |
| `--filter` | `string` |  | Extract only specific token types |
| `--output` | `string` |  | Write output to file instead of stdout |

#### Output

Type: `unknown`

#### Examples

```sh
# Export tokens in DTCG format
figma tokens export abc123FileKey --format dtcg

# Export only color tokens in flat format
figma tokens export abc123FileKey --format flat --filter colors
```
