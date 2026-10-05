export const BIO_DATA_KINDS = { public: '公开数据编号', counts: '基因计数矩阵', single_cell: '单细胞 / 空间对象', raw: '原始测序文件', results: '已有分析结果', other: '其他材料' };
export const BIO_INPUT_FIELDS = {
  location: ['材料位置或公开编号', '填写已有文件位置或 GEO 等编号；这里只记录，不读取文件'],
  species: ['物种', '例如：人、小鼠；不确定可以留空'],
  reference: ['参考版本 / 数据处理层级', '参考基因组、注释版本，或原始 / 标准化数据等'],
  samples: ['样本与分组', '生物学样本、组别、批次或配对关系；单细胞另注明细胞数'],
  comparison: ['想比较或解释什么', '填写具体比较；已有目标不用重复说明'],
  output: ['希望得到什么', '例如：材料检查、分析方案、结果表、图或解释'],
};

export function validBioInput(value) {
  return value === undefined || value === null || (typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every(key => key === 'kind' ? Object.hasOwn(BIO_DATA_KINDS, value.kind) : Object.hasOwn(BIO_INPUT_FIELDS, key) && typeof value[key] === 'string' && value[key].length <= 800));
}

export function bioInputPrompt(value) {
  if (!value || !validBioInput(value)) return [];
  const entries = Object.entries(BIO_INPUT_FIELDS).filter(([key]) => value[key]?.trim());
  if (!value.kind && !entries.length) return [];
  return ['', '【本步生信材料线索（用户填写，尚未读取或验证）】',
    ...(value.kind ? [`材料类型：${BIO_DATA_KINDS[value.kind]}`] : []),
    ...entries.map(([key, [label]]) => `${label}：${value[key]}`),
    '先从已有授权记录恢复物种、参考版本、样本单位、分组和比较目标；只追问会改变分析的缺项。路径与编号只是线索，不授予额外文件/联网权限。',
    '区分可提供方案、可检查材料和可执行分析。检查真实 R/Python/工具版本、资源、输入类型及既有有效授权；依赖未就绪不声称可以运行，不默认安装整套工具或下载大数据。',
    '参考 references/bioinformatics-delivery.md。真实运行才记录运行编号、命令/脚本、参数、环境、日志、退出结果及成果校验和；方案不登记为运行，计算成功不等于结论得到验证。'];
}
