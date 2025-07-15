<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";

  export let points: Array<{ id: string; priority: number }>; // 所有文档点
  export let currentId: string; // 当前文档ID
  export let minPriority: number = 0;
  export let maxPriority: number = 10;
  // 宽度自适应，内部坐标系固定800
  const width = 800;
  export let height: number = 48; // 控制纵向高度

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

  function onPointerDown(e: PointerEvent, point) {
    if (point.id !== currentId) return;
    dragging = true;
    // 直接使用clientX而不是offsetX，解决不跟手问题
    const rect = (e.target as SVGElement).closest("svg").getBoundingClientRect();
    dragX = e.clientX - rect.left;
    dragPriority = point.priority;
    lastSavedPriority = point.priority;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    
    // 阻止事件冒泡和默认行为，确保拖动平滑
    e.stopPropagation();
    e.preventDefault();
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    const rect = (e.target as SVGElement).closest("svg").getBoundingClientRect();
    let x = e.clientX - rect.left;
    x = Math.max(0, Math.min(width, x));
    dragX = x;
    // 计算优先级
    dragPriority = minPriority + (x / width) * (maxPriority - minPriority);
    dragPriority = Math.max(minPriority, Math.min(maxPriority, dragPriority));
    dispatch("dragging", { priority: dragPriority });
    
    // 阻止事件冒泡和默认行为
    e.stopPropagation();
    e.preventDefault();
  }

  function onPointerUp(e: PointerEvent) {
    if (!dragging) return;
    // 发送变更事件
    dispatch("change", { priority: dragPriority });
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    
    // 立即设置dragging为false，不要等待数据更新
    // 这样可以避免拖动结束后的不跟手问题
    dragging = false;
    
    // 阻止事件冒泡和默认行为
    e.stopPropagation();
    e.preventDefault();
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
  $: currentX = dragging
    ? dragX
    : currentPoint
    ? ((currentPoint.priority - minPriority) / (maxPriority - minPriority)) * width
    : 0;
  $: currentY = currentPoint ? getY(currentId) : height / 2;
  $: currentPriority = dragging ? dragPriority : currentPoint ? currentPoint.priority : 0;
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
        <circle
          cx={(p.priority - minPriority) / (maxPriority - minPriority) * width}
          cy={getY(p.id)}
          r="5"
          fill="#90caf9"
          opacity="0.7"
        />
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
  </svg>
</div>

<style>
  svg {
    user-select: none;
  }
</style> 