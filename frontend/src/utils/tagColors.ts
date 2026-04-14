const TAG_PALETTE = [
    '#e41a1c', '#377eb8', '#4daf4a', '#984ea3',
    '#ff7f00', '#a65628', '#f781bf', '#999999',
    '#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3',
    '#a6d854', '#ffd92f', '#e5c494', '#b3b3b3'
]

function hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash
    }
    return Math.abs(hash)
}

export function getTagColor(tag: string): string {
    if (!tag) return '#999999'
    const hash = hashString(tag)
    return TAG_PALETTE[hash % TAG_PALETTE.length]
}

export const LOG_LEVEL_COLORS: Record<string, string> = {
    VERBOSE: '#999999',
    DEBUG: '#377eb8',
    INFO: '#4daf4a',
    WARN: '#ff7f00',
    ERROR: '#e41a1c',
    ASSERT: '#984ea3'
}

export function getLogLevelColor(level: string): string {
    return LOG_LEVEL_COLORS[level] ?? '#999999'
}
