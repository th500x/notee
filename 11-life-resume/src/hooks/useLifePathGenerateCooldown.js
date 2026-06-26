import { useEffect, useMemo, useState } from 'react';
import {
  assessLifePathGenerateCooldown,
  DEFAULT_LIFE_PATH_COOLDOWN_HOURS,
  formatLifePathCooldownRemaining,
} from '@shared/utils/lifeResumeLifePath.js';

export function useLifePathGenerateCooldown({
  generatedAt,
  availableAt,
  cooldownHours = DEFAULT_LIFE_PATH_COOLDOWN_HOURS,
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  const assessment = useMemo(
    () => assessLifePathGenerateCooldown(generatedAt, cooldownHours, new Date(nowMs)),
    [generatedAt, cooldownHours, nowMs]
  );

  const remainingMs = useMemo(() => {
    if (availableAt) {
      return Math.max(0, new Date(availableAt).getTime() - nowMs);
    }
    return assessment.remainingMs;
  }, [availableAt, assessment.remainingMs, nowMs]);

  const onCooldown = remainingMs > 0;

  useEffect(() => {
    if (!onCooldown) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(timer);
  }, [onCooldown]);

  return {
    onCooldown,
    remainingText: formatLifePathCooldownRemaining(remainingMs),
  };
}
