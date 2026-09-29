import { ArrowLeft } from '@phosphor-icons/react';

export function PageBack({ onBack, label = '返回' }) {
  return <div className="page-back-row"><button className="back-link" type="button" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />{label}</button></div>;
}
