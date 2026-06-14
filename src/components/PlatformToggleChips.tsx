import type { PlatformId, PlatformSpec } from '../lib/platforms/types';
import { PLATFORM_ICONS } from './platformIcons';

interface PlatformToggleChipsProps {
  specs: PlatformSpec[];
  enabled: PlatformId[];
  // Platforms that are disabled but still hold a customized (forked) version;
  // shown with an indicator dot. Empty until fork-on-edit (Phase C).
  dormant?: PlatformId[];
  onToggle: (id: PlatformId) => void;
}

export function PlatformToggleChips({ specs, enabled, dormant = [], onToggle }: PlatformToggleChipsProps) {
  const enabledSet = new Set(enabled);
  const dormantSet = new Set(dormant);

  return (
    <div className="platform-chips" role="group" aria-label="Platforms to preview">
      {specs.map((spec) => {
        const isEnabled = enabledSet.has(spec.id);
        const Icon = PLATFORM_ICONS[spec.id];

        return (
          <button
            key={spec.id}
            type="button"
            className={`platform-chip is-${spec.id}${isEnabled ? ' is-enabled' : ''}`}
            aria-pressed={isEnabled}
            style={isEnabled ? { color: spec.brandColor } : undefined}
            onClick={() => onToggle(spec.id)}
          >
            <Icon size={15} />
            <span>{spec.label}</span>
            {!isEnabled && dormantSet.has(spec.id) ? (
              <span className="platform-chip-dot" aria-label="Has a saved customization" title="Has a saved customization" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
