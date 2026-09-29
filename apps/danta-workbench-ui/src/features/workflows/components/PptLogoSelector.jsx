import { CheckCircle, SealCheck, UploadSimple, XCircle } from '@phosphor-icons/react';
import { PPT_LOGO_CHOICES } from '../../../shared/constants/pptLogos.js';

const CHOICE_ICONS = {
  custom: UploadSimple,
  none: XCircle,
};

export function PptLogoSelector({ selectedLogo, onSelectLogo }) {
  const selectedTitle = selectedLogo?.title;
  const status = selectedLogo
    ? selectedLogo.id === 'custom'
      ? '已选择自备 Logo。请在后续 Codex 对话中附上获授权的透明底 PNG 或 SVG；工作台只生成启动语，不会读取或上传文件。'
      : selectedLogo.id === 'none'
        ? '已选择通用版式，启动语会明确要求不添加学校或实验室 Logo。'
        : `已选择${selectedTitle}。制作时会使用内置原图，并保持比例与原有颜色。`
    : '尚未选择 Logo。启动前会先引导确认汇报单位；未确认前不自动放入任何学校标识。';

  return (
    <section className="ppt-logo-library" aria-labelledby="ppt-logo-title">
      <div className="ppt-logo-heading">
        <div>
          <span className="panel-kicker">单位标识 · 可选</span>
          <h2 id="ppt-logo-title">汇报中使用哪所学校的 Logo？</h2>
          <p>按本次汇报的实际归属选择。内置校徽可直接使用；其他单位请在 Codex 对话中提供获授权的透明底 PNG 或 SVG。</p>
        </div>
        <SealCheck size={22} aria-hidden="true" />
      </div>

      <div className="ppt-logo-grid" role="group" aria-label="选择汇报单位 Logo">
        {PPT_LOGO_CHOICES.map(choice => {
          const selected = selectedLogo?.id === choice.id;
          const Icon = CHOICE_ICONS[choice.id];
          return (
            <button
              key={choice.id}
              className={`ppt-logo-choice${selected ? ' is-selected' : ''}${choice.image ? '' : ' has-no-image'}`}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelectLogo(selected ? null : choice)}
              style={{ '--logo-accent': choice.accent }}
            >
              <span className="ppt-logo-preview">
                {choice.image ? <img src={choice.image} alt={`${choice.title}校徽`} loading="lazy" /> : <Icon size={31} weight="regular" aria-hidden="true" />}
                {selected && <span className="ppt-logo-check"><CheckCircle size={16} weight="fill" aria-hidden="true" />已选</span>}
              </span>
              <span className="ppt-logo-copy"><small>{choice.type}</small><strong>{choice.title}</strong><span>{choice.description}</span></span>
            </button>
          );
        })}
      </div>

      <p className="ppt-logo-status" aria-live="polite">{status}</p>
    </section>
  );
}
