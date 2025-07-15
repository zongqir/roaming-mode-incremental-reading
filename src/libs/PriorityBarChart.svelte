<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";

  export let points: Array<{ id: string; priority: number; title?: string }>; // 所有文档点，添加可选的title属性
  export let currentId: string; // 当前文档ID
  // 这两个参数不再用于显示计算，仅用于限制拖动范围
  export let minPriority: number = 0;
  export let maxPriority: number = 10;
  // 宽度自适应，内部坐标系固定800
  const width = 800;
  export let height: number = 48; // 控制纵向高度
  
  // 固定显示范围为0-10
  const displayMin = 0;
  const displayMax = 10;

  const dispatch = createEventDispatcher();

  // 生成点的Y轴随机分布（固定种子，避免每次渲染乱跳）
  let yMap: Record<string, number> = {};
  function getY(id: string) {
    if (!(id in yMap)) {
      // 伪随机但稳定
      let hash = 0;
      for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 9973;
      yMap[id] = 12 + (hash % (height - 24)); // 保证点不贴边
    }
    return yMap[id];
  }

  // 拖动相关
  let dragging = false;
  let dragX = 0;
  let dragPriority = 0;
  let lastSavedPriority = 0; // 记录上次保存的优先级
  let draggingId = ""; // 记录当前拖动的点ID
  let dragStartOffset = 0; // 记录开始拖动时的偏移量，用于解决不跟手问题

  // 悬停显示文档标题相关
  let hoveringId = ""; // 记录当前悬停的点ID
  let hoverX = 0;
  let hoverY = 0;

  function onPointerDown(e: PointerEvent, point) {
    dragging = true;
    draggingId = point.id;
    
    // 获取SVG元素和边界
    const svgElement = (e.target as SVGElement).closest("svg");
    const rect = svgElement.getBoundingClientRect();
    
    // 计算点的实际X坐标
    const pointX = (point.priority / (displayMax - displayMin)) * width;
    
    // 计算鼠标相对于SVG左边的位置
    const mouseX = e.clientX - rect.left;
    
    // 计算鼠标点击位置与点实际位置的偏移量
    dragStartOffset = mouseX - pointX;
    
    // 初始拖动位置就是点的实际位置
    dragX = pointX;
    dragPriority = point.priority;
    lastSavedPriority = point.priority;
    
    // 添加事件监听
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    
    // 阻止事件冒泡和默认行为，确保拖动平滑
    e.stopPropagation();
    e.preventDefault();
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    
    // 获取SVG元素和边界
    const svgElement = (e.target as SVGElement).closest("svg");
    const rect = svgElement ? svgElement.getBoundingClientRect() : 
                (document.querySelector("svg") as SVGElement).getBoundingClientRect();
    
    // 计算鼠标相对于SVG的位置，并考虑起始偏移量
    let x = (e.clientX - rect.left) - dragStartOffset;
    
    // 限制在SVG范围内
    x = Math.max(0, Math.min(width, x));
    dragX = x;
    
    // 计算优先级 - 固定在0-10范围内
    const rawValue = (x / width) * (displayMax - displayMin);
    // 保留两位小数，先四舍五入到两位，再转回数字，确保精度一致
    dragPriority = parseFloat(rawValue.toFixed(2));
    // 然后限制在允许的minPriority和maxPriority之间
    dragPriority = Math.max(minPriority, Math.min(maxPriority, dragPriority));
    dispatch("dragging", { priority: dragPriority, id: draggingId });
    
    // 阻止事件冒泡和默认行为
    e.stopPropagation();
    e.preventDefault();
  }

  function onPointerUp(e: PointerEvent) {
    if (!dragging) return;
    // 发送变更事件
    dispatch("change", { priority: dragPriority, id: draggingId });
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    
    // 立即设置dragging为false，不要等待数据更新
    // 这样可以避免拖动结束后的不跟手问题
    dragging = false;
    draggingId = "";
    
    // 阻止事件冒泡和默认行为
    e.stopPropagation();
    e.preventDefault();
  }

  // 处理点的悬停
  function onPointHover(e: PointerEvent, point) {
    hoveringId = point.id;
    hoverX = e.offsetX;
    hoverY = e.offsetY;
  }

  // 处理点的右击，新标签页打开文档
  function onPointContextMenu(e: MouseEvent, point) {
    // 阻止默认的右键菜单
    e.preventDefault();
    e.stopPropagation();
    
    // 拖动中不触发右键功能
    if (dragging) return;
    
    // 发送打开文档事件
    dispatch("openDocument", { id: point.id });
  }

  function onPointLeave() {
    hoveringId = "";
  }

  // 监听 points 变化，当数据更新后重置拖动状态
  $: if (points && points.length > 0) {
    const currentPoint = points.find(p => p.id === currentId);
    if (currentPoint) {
      // 数据已更新，更新最后保存的优先级
      lastSavedPriority = currentPoint.priority;
    }
  }

  // 当前文档点的X
  $: currentPoint = points.find(p => p.id === currentId);
  $: currentX = dragging && draggingId === currentId
    ? dragX
    : currentPoint
    ? (currentPoint.priority / (displayMax - displayMin)) * width
    : 0;
  $: currentY = currentPoint ? getY(currentId) : height / 2;
  $: currentPriority = dragging && draggingId === currentId ? dragPriority : currentPoint ? currentPoint.priority : 0;

  // 当前悬停的点
  $: hoverPoint = points.find(p => p.id === hoveringId);
</script>

<div style="margin: 12px 0;">
  <svg viewBox="0 0 800 64" height={height + 16} style="display:block;overflow:visible;width:100%;">
    <!-- 白色外框 -->
    <rect x="0" y="0" width={width} height={height} fill="none" stroke="#e0e0e0" stroke-width="1" rx="4" />
    
    <!-- 刻度线和数字 -->
    {#each Array.from({length: 11}, (_, i) => i) as tick}
      {@const tickX = (tick / 10) * width}
      <!-- 刻度线 -->
      <line 
        x1={tickX} 
        y1="0" 
        x2={tickX} 
        y2={height} 
        stroke="#e0e0e0" 
        stroke-width="1" 
        opacity="0.6"
      />
      <!-- 刻度数字 -->
      <text 
        x={tickX} 
        y={height + 16} 
        font-size="11" 
        fill="#666" 
        text-anchor="middle" 
        font-weight="500"
      >{tick}</text>
    {/each}
    
    <!-- 其他文档点 -->
    {#each points as p (p.id)}
      {#if p.id !== currentId}
        <!-- 蓝点也可以拖动、显示标题、右击打开 -->
        {@const isThisDragging = dragging && draggingId === p.id}
        {@const pointX = isThisDragging ? dragX : (p.priority / (displayMax - displayMin)) * width}
        {@const pointY = getY(p.id)}
        {@const thisPointPriority = isThisDragging ? dragPriority : p.priority}
        <g>
          <circle
            cx={pointX}
            cy={pointY}
            r="5"
            fill="#90caf9"
            opacity={hoveringId === p.id ? "1" : "0.7"}
            stroke={hoveringId === p.id ? "#fff" : "none"}
            stroke-width={hoveringId === p.id ? "1" : "0"}
            style="cursor: pointer;"
            on:pointerdown={(e) => onPointerDown(e, p)}
            on:pointerover={(e) => onPointHover(e, p)}
            on:pointerout={onPointLeave}
            on:contextmenu={(e) => onPointContextMenu(e, p)}
          />
          <!-- 拖动蓝点时也显示优先级 -->
          {#if isThisDragging}
            <text
              x={pointX}
              y={pointY - 10}
              font-size="11"
              fill="#3f51b5"
              text-anchor="middle"
              font-weight="bold"
              style="user-select:none;"
            >{thisPointPriority.toFixed(2)}</text>
          {/if}
        </g>
      {/if}
    {/each}
    <!-- 当前文档点（高亮+可拖动） -->
    {#if currentPoint}
      <circle
        cx={currentX}
        cy={currentY}
        r="8"
        fill="#ff5252"
        stroke="#fff"
        stroke-width="2"
        style="cursor: pointer;"
        on:pointerdown={(e) => onPointerDown(e, currentPoint)}
        on:pointerover={(e) => onPointHover(e, currentPoint)}
        on:pointerout={onPointLeave}
        on:contextmenu={(e) => onPointContextMenu(e, currentPoint)}
      />
      <!-- 拖动时显示优先级数值 -->
      <text
        x={currentX}
        y={currentY - 14}
        font-size="12"
        fill="#ff5252"
        text-anchor="middle"
        font-weight="bold"
        style="user-select:none;"
      >{currentPriority.toFixed(2)}</text>
    {/if}
    
    <!-- 悬停文档标题提示 -->
    {#if hoveringId && hoverPoint?.title}
      <g>
        <rect 
          x={Math.min(Math.max(10, (hoverPoint.priority / (displayMax - displayMin)) * width - 100), width - 200)}
          y={getY(hoveringId) - 35} 
          width="200" 
          height="25" 
          rx="4" 
          fill="rgba(0,0,0,0.7)"
        />
        <text 
          x={Math.min(Math.max(10, (hoverPoint.priority / (displayMax - displayMin)) * width - 100), width - 200) + 100}
          y={getY(hoveringId) - 18}
          font-size="12" 
          fill="#ffffff" 
          text-anchor="middle"
          style="user-select:none;"
        >{hoverPoint.title}</text>
      </g>
    {/if}
  </svg>
</div>

<style>
  svg {
    user-select: none;
  }
</style> 