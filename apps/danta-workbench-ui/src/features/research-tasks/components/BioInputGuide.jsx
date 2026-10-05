import { BIO_DATA_KINDS, BIO_INPUT_FIELDS } from '../../../shared/utils/bioInputs.js';

export function BioInputGuide({ step, onChange }) {
  const value = step.bioInput || {};
  return <details key={step.key} className="bio-input-guide">
    <summary>涉及生信材料？补充线索 <span>{step.bioInput ? '已自动保存' : '按需填写'}</span></summary>
    <p>能说明多少就填多少，也可以直接在 Codex 中讨论。已有记录会沿用；这里不读取文件、不运行分析。</p>
    <div className="bio-input-fields">
      <label>手头有什么？<select value={value.kind || ''} onChange={event => onChange(event.target.value ? { ...value, kind: event.target.value } : Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'kind')))}>
        <option value="">未确定</option>{Object.entries(BIO_DATA_KINDS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select></label>
      {Object.entries(BIO_INPUT_FIELDS).map(([key, [label, placeholder]]) => <label key={key}>{label}<textarea rows={2} maxLength={800} value={value[key] || ''} placeholder={placeholder} onChange={event => onChange({ ...value, [key]: event.target.value })} /></label>)}
    </div>
    <p className="bio-input-readiness">执行条件尚未核对 · 进入 Codex 后按本步需要检查环境和材料。</p>
    <button type="button" className="text-button" onClick={() => onChange(null)}>清除本步材料线索</button>
  </details>;
}
