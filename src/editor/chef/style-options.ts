export const cursorOptions = ['auto', 'default', 'pointer', 'grab', 'grabbing', 'text', 'crosshair', 'move', 'not-allowed', 'wait', 'zoom-in', 'zoom-out', 'none']

export const displayOptions = ['block', 'flex', 'grid', 'inline-flex', 'inline-block', 'inline', 'none']

export const flexDirectionOptions = ['row', 'row-reverse', 'column', 'column-reverse']

export const justifyOptions = ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly']

export const alignOptions = ['stretch', 'flex-start', 'center', 'flex-end', 'baseline']

export const positionOptions = ['static', 'relative', 'absolute', 'fixed', 'sticky']

export const overflowOptions = ['visible', 'hidden', 'scroll', 'auto']

export const borderStyleOptions = ['none', 'solid', 'dashed', 'dotted', 'double']

export const blendModeOptions = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion']

export const textTransformOptions = ['none', 'uppercase', 'lowercase', 'capitalize']

export const persistedStyleKeys = [
  'backgroundColor', 'color', 'borderColor', 'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius',
  'borderBottomRightRadius', 'borderBottomLeftRadius', 'borderWidth', 'borderStyle', 'opacity', 'margin',
  'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'padding', 'paddingTop', 'paddingRight',
  'paddingBottom', 'paddingLeft', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle', 'textAlign',
  'lineHeight', 'letterSpacing', 'wordSpacing', 'textTransform', 'textDecorationLine', 'display',
  'flex', 'flexBasis', 'flexGrow', 'flexShrink', 'flexDirection', 'justifyContent', 'alignItems', 'flexWrap', 'gap', 'gridTemplateColumns',
  'gridTemplateRows', 'position', 'zIndex', 'overflow', 'cursor', 'width', 'height', 'minWidth',
  'maxWidth', 'minHeight', 'maxHeight', 'aspectRatio', 'boxSizing', 'left', 'top', 'right', 'bottom', 'transform', 'boxShadow', 'textShadow',
  'filter', 'backdropFilter', 'mixBlendMode', 'backgroundImage', 'backgroundSize',
  'backgroundPosition', 'backgroundRepeat', 'backgroundAttachment',
] as const
