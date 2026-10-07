import React, { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Alert, Avatar as AntAvatar, Button as AntButton, Card as AntCard, Empty as AntEmpty, Modal as AntModal, Segmented, Space, Spin as AntSpin, Tag as AntTag, Typography } from 'antd';
import { Loader2, X } from 'lucide-react';

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------- Button
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  type,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  type?: 'button' | 'submit' | 'reset';
  form?: string;
}) {
  const antType = variant === 'primary' ? 'primary' : variant === 'danger' ? 'primary' : variant === 'secondary' ? 'default' : 'text';
  return (
    <AntButton
      type={antType}
      danger={variant === 'danger'}
      size={size === 'sm' ? 'small' : 'middle'}
      loading={loading}
      icon={loading ? undefined : (icon as ReactNode)}
      disabled={disabled}
      htmlType={type ?? 'button'}
      className={className}
      {...(rest as Record<string, unknown>)}
    >
      {children}
    </AntButton>
  );
}

// ---------------------------------------------------------------- Card
export function Card({ className, children, hoverable }: { className?: string; children: ReactNode; hoverable?: boolean }) {
  return (
    <AntCard variant="outlined" hoverable={hoverable} className={className} styles={{ body: { padding: 0 } }}>
      {children}
    </AntCard>
  );
}

export function CardHeader({ title, action, subtitle, icon }: { title: ReactNode; action?: ReactNode; subtitle?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#edf4f5] text-[#1c5e6b]">{icon}</span>}
        <div className="min-w-0">
          <Typography.Title level={5} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          {subtitle && <Typography.Text type="secondary" style={{ fontSize: 13 }}>{subtitle}</Typography.Text>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="animate-rise mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <Typography.Text strong style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#2a7886' }}>
            {eyebrow}
          </Typography.Text>
        )}
        <Typography.Title level={2} style={{ margin: eyebrow ? '6px 0 0' : 0 }}>{title}</Typography.Title>
        {subtitle && (
          <Typography.Paragraph type="secondary" style={{ margin: '6px 0 0', maxWidth: '65ch' }}>
            {subtitle}
          </Typography.Paragraph>
        )}
      </div>
      {actions && <Space wrap>{actions}</Space>}
    </header>
  );
}

// ---------------------------------------------------------------- Form fields
export function Field({ label, hint, error, children, className }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-[#485a61]">
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="text-[13px] text-[#74868c]">{hint}</p>}
      {error && <p className="text-[13px] text-[#c23b2c]">{error}</p>}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  // Păstrăm input nativ stilizat pe token-ii Ant Design (suport complet
  // pentru type=date/time/number + clase utilitare precum pl-9).
  return <input className={cn('ant-care-input h-[42px] w-full rounded-[10px] border border-[#d6dedd] bg-white px-3 text-[#13222a] placeholder:text-[#74868c] hover:border-[#6fa9b3] focus:border-[#2a7886] focus:ring-4 focus:ring-[#d2e5e8] focus:outline-none disabled:bg-[#f1f4f3]', className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('ant-care-input min-h-20 w-full rounded-[10px] border border-[#d6dedd] bg-white px-3 py-2 text-[#13222a] placeholder:text-[#74868c] hover:border-[#6fa9b3] focus:border-[#2a7886] focus:ring-4 focus:ring-[#d2e5e8] focus:outline-none disabled:bg-[#f1f4f3]', className)} {...rest} />;
}

type NativeSelectProps = SelectHTMLAttributes<HTMLSelectElement>;

function toAntOptions(children: ReactNode): { value: string; label: ReactNode }[] | { label: ReactNode; options: { value: string; label: ReactNode }[] }[] {
  const out: { value: string; label: ReactNode }[] = [];
  const groups: { label: ReactNode; options: { value: string; label: ReactNode }[] }[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as { value?: string; children?: ReactNode; label?: ReactNode };
    if (child.type === 'optgroup') {
      const opts: { value: string; label: ReactNode }[] = [];
      React.Children.forEach(props.children as ReactNode, (o) => {
        if (React.isValidElement(o) && o.type === 'option') {
          const op = o.props as { value?: string; children?: ReactNode };
          opts.push({ value: String(op.value ?? ''), label: op.children });
        }
      });
      groups.push({ label: props.label, options: opts });
    } else if (child.type === 'option') {
      out.push({ value: String(props.value ?? ''), label: props.children });
    }
  });
  return groups.length ? [...(out.length ? [{ label: '', options: out }] : []), ...groups] : out;
}

export function Select({ className, children, value, defaultValue, onChange, placeholder, ...rest }: NativeSelectProps & { placeholder?: string }) {
  // Compatibilitate: acceptă <option>/<optgroup> nativi, dar randează
  // un dropdown Ant Design real (popup, search, tastatură).
  const options = React.useMemo(() => toAntOptions(children), [children]);
  return (
    <AntSelectCompat
      className={className}
      value={value as string | undefined}
      defaultValue={defaultValue as string | undefined}
      options={options as never}
      placeholder={placeholder}
      onNativeChange={onChange}
      rest={rest}
    />
  );
}

import { Select as AntSelect } from 'antd';

function AntSelectCompat({ className, value, defaultValue, options, placeholder, onNativeChange, rest }: {
  className?: string;
  value?: string;
  defaultValue?: string;
  options: never;
  placeholder?: string;
  onNativeChange?: NativeSelectProps['onChange'];
  rest: Omit<NativeSelectProps, 'value' | 'defaultValue' | 'onChange' | 'children' | 'className' | 'placeholder'>;
}) {
  return (
    <AntSelect
      className={className}
      style={{ minWidth: 180 }}
      value={value}
      defaultValue={defaultValue}
      options={options}
      placeholder={placeholder}
      allowClear={false}
      showSearch
      optionFilterProp="label"
      disabled={rest.disabled}
      aria-label={rest['aria-label']}
      onChange={(v) => {
        onNativeChange?.({ target: { value: String(v ?? '') } } as unknown as React.ChangeEvent<HTMLSelectElement>);
      }}
    />
  );
}

// ---------------------------------------------------------------- Badge -> Ant Tag
export type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'bad' | 'plan';
const TONE_COLOR: Record<Tone, 'default' | 'cyan' | 'success' | 'warning' | 'error' | 'purple'> = {
  neutral: 'default',
  brand: 'cyan',
  ok: 'success',
  warn: 'warning',
  bad: 'error',
  plan: 'purple',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <AntTag color={TONE_COLOR[tone]} bordered={false} className={cn('!rounded-full !px-2.5 !py-0.5 !text-xs !font-semibold', className)}>
      {children}
    </AntTag>
  );
}

// ---------------------------------------------------------------- Modal -> Ant Modal
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  return (
    <AntModal open={open} onCancel={onClose} title={title} footer={footer ?? null} width={wide ? 720 : 520} centered destroyOnHidden maskClosable>
      {children}
    </AntModal>
  );
}

// ---------------------------------------------------------------- Misc
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-10" role="status">
      <AntSpin size="large" tip={label} />
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: ReactNode; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-6 py-8">
      <AntEmpty image={icon ?? AntEmpty.PRESENTED_IMAGE_SIMPLE} description={<span><span className="font-medium text-[#13222a]">{title}</span>{text && <span className="mt-1 block max-w-[48ch] text-sm text-[#74868c]">{text}</span>}</span>}>
        {action}
      </AntEmpty>
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <Alert type="error" showIcon message={children} style={{ borderRadius: 10 }} />;
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode; icon?: ReactNode }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="mb-6" role="tablist">
      <Segmented
        value={value}
        onChange={(v) => onChange(v as T)}
        options={tabs.map((tab) => ({
          value: tab.id,
          label: (
            <span className="inline-flex items-center gap-2 px-1 py-0.5">
              {tab.icon}
              {tab.label}
            </span>
          ),
        }))}
        size="middle"
      />
    </div>
  );
}

/** Circular progress ring around content — used for "today's care completed". */
export function Ring({ value, size = 56, stroke = 4, children, tone = 'ok' }: { value: number | null; size?: number; stroke?: number; children?: ReactNode; tone?: 'ok' | 'sun' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.max(0, Math.min(1, value));
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth={stroke} />
        {value !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={tone === 'ok' ? 'var(--color-ok-600)' : 'var(--color-sun-500)'}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            style={{ transition: 'stroke-dashoffset .6s ease' }}
          />
        )}
      </svg>
      {children}
    </span>
  );
}

const AVATAR_COLORS = ['#164b56', '#1c5e6b', '#2a7886', '#4a4e94', '#5b5fa8', '#2c6b3a'];

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <AntAvatar size={size} style={{ backgroundColor: AVATAR_COLORS[hash % AVATAR_COLORS.length], fontWeight: 600, flexShrink: 0 }}>
      {initials || '?'}
    </AntAvatar>
  );
}

export function CloseButton({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label ?? 'Close'} className="rounded p-1.5 text-[#74868c] hover:bg-[#e6eceb] hover:text-[#13222a]">
      <X size={18} />
    </button>
  );
}

export function LoadingIcon() {
  return <Loader2 size={16} className="animate-spin" />;
}
