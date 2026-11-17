export interface GlucoseTargets {
  low_threshold: number;
  fasting_min: number;
  fasting_max: number;
  post_meal_max: number;
}

export interface GlucoseEvaluation {
  label: string;
  status: 'low' | 'normal' | 'elevated' | 'high';
  message: string;
  warning: string | null;
  targetDescription: string;
}

export function evaluateGlucoseReading(
  value: number,
  readingType: 'fasting' | 'post_meal',
  targets: GlucoseTargets
): GlucoseEvaluation {
  const lowThreshold = Number.isFinite(targets.low_threshold) ? targets.low_threshold : 70;
  const fastingMin = Number.isFinite(targets.fasting_min) ? targets.fasting_min : 70;
  const fastingMax = Number.isFinite(targets.fasting_max) ? targets.fasting_max : 99;
  const postMealMax = Number.isFinite(targets.post_meal_max) ? targets.post_meal_max : 140;

  if (value < 54) {
    return {
      label: 'Severe Low',
      status: 'low',
      message: `Reading (${value} mg/dL) is critically below your low threshold (${lowThreshold} mg/dL).`,
      warning:
        'Urgent safety notice: Check symptoms right away. If conscious and able to swallow safely, follow your clinician hypoglycemia plan. If unconscious, confused, or unable to swallow, NEVER give food or liquids—call 112 or emergency services immediately.',
      targetDescription:
        readingType === 'fasting'
          ? `Fasting target: ${fastingMin}–${fastingMax} mg/dL`
          : `Post-meal target: ${lowThreshold}–${postMealMax} mg/dL`,
    };
  }

  if (value < (readingType === 'fasting' ? Math.min(lowThreshold, fastingMin) : lowThreshold)) {
    return {
      label: 'Below Target (Low)',
      status: 'low',
      message: `Reading (${value} mg/dL) is below the configured ${readingType === 'fasting' ? 'fasting' : 'post-meal'} lower bound.`,
      warning:
        'Notice: Low glucose can progress quickly. Recheck in 15 minutes if symptomatic and follow guidance provided by your healthcare provider.',
      targetDescription:
        readingType === 'fasting'
          ? `Fasting target: ${fastingMin}–${fastingMax} mg/dL`
          : `Post-meal target: ${lowThreshold}–${postMealMax} mg/dL`,
    };
  }

  if (readingType === 'fasting') {
    if (value <= fastingMax) {
      return {
        label: 'Within Fasting Target',
        status: 'normal',
        message: `Fasting reading (${value} mg/dL) is within your configured fasting range (${fastingMin}–${fastingMax} mg/dL).`,
        warning: null,
        targetDescription: `Fasting target: ${fastingMin}–${fastingMax} mg/dL`,
      };
    }
    if (value < 126) {
      return {
        label: 'Above Fasting Target',
        status: 'elevated',
        message: `Fasting reading (${value} mg/dL) is above your configured fasting upper limit (${fastingMax} mg/dL).`,
        warning:
          'Elevated fasting reading logged. Share persistent above-target morning readings with your healthcare provider at your next review.',
        targetDescription: `Fasting target: ${fastingMin}–${fastingMax} mg/dL`,
      };
    }
    return {
      label: 'High Fasting Reading',
      status: 'high',
      message: `Fasting reading (${value} mg/dL) is notably elevated above your fasting target (${fastingMax} mg/dL).`,
      warning:
        value >= 250
          ? 'High alert: Readings at or above 250 mg/dL require prompt medical evaluation, especially if accompanied by nausea, vomiting, rapid breathing, or confusion.'
          : 'High fasting reading recorded. Monitor hydration and consult your healthcare team if elevated fasting readings persist.',
      targetDescription: `Fasting target: ${fastingMin}–${fastingMax} mg/dL`,
    };
  }

  // Post-meal evaluation uses separate post-meal target criteria
  if (value <= postMealMax) {
    return {
      label: 'Within Post-Meal Target',
      status: 'normal',
      message: `Post-meal reading (${value} mg/dL) is within your configured post-meal limit (≤ ${postMealMax} mg/dL).`,
      warning: null,
      targetDescription: `Post-meal target: ${lowThreshold}–${postMealMax} mg/dL`,
    };
  }

  if (value < 200) {
    return {
      label: 'Above Post-Meal Target',
      status: 'elevated',
      message: `Post-meal reading (${value} mg/dL) exceeds your configured post-meal target (${postMealMax} mg/dL).`,
      warning:
        'Above-target post-meal reading recorded. Note meal composition and timing in your log to review patterns with your doctor.',
      targetDescription: `Post-meal target: ${lowThreshold}–${postMealMax} mg/dL`,
    };
  }

  return {
    label: 'High Post-Meal Reading',
    status: 'high',
    message: `Post-meal reading (${value} mg/dL) is significantly above your post-meal limit (${postMealMax} mg/dL).`,
    warning:
      value >= 250
        ? 'High alert: Readings at or above 250 mg/dL require prompt medical attention if paired with excessive thirst, abdominal pain, vomiting, or drowsiness.'
        : 'High post-meal reading recorded. Stay hydrated and contact your healthcare provider if high readings continue.',
    targetDescription: `Post-meal target: ${lowThreshold}–${postMealMax} mg/dL`,
  };
}
