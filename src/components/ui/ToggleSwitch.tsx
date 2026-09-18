import React from 'react';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: React.ReactNode;
  className?: string;
  id?: string;
};

const ToggleSwitch: React.FC<Props> = ({
  checked,
  onChange,
  disabled = false,
  label,
  className = '',
  id,
}) => {
  const control = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`fc-switch ${checked ? 'fc-switch-on' : ''} ${disabled ? 'fc-switch-disabled' : ''}`}
    >
      <span className="fc-switch-thumb" />
    </button>
  );

  if (!label) {
    return <span className={className}>{control}</span>;
  }

  return (
    <label
      className={`fc-switch-field ${disabled ? 'opacity-60' : 'cursor-pointer'} ${className}`}
      onClick={(e) => {
        if (disabled) return;
        if ((e.target as HTMLElement).closest('button')) return;
        onChange(!checked);
      }}
    >
      {control}
      <span className="text-sm text-ink/80">{label}</span>
    </label>
  );
};

export default ToggleSwitch;
