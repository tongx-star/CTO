'use client';

import type { GameSnapshot } from '../../lib/game/types';

interface GameHudProps {
  snapshot: GameSnapshot;
}

const heartSymbol = '❤';

export function GameHud({ snapshot }: GameHudProps) {
  const hearts = Array.from({ length: 3 }, (_, index) => (
    <span
      key={index}
      style={{
        color: index < snapshot.lives ? '#ff6b81' : '#3a4a5c',
        marginRight: index < 2 ? '0.25rem' : 0
      }}
    >
      {heartSymbol}
    </span>
  ));

  return (
    <div className="pixel-card" style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '1.35rem', letterSpacing: '0.08em' }}>指挥官：{snapshot.username || '未设置'}</div>
          <div style={{ color: 'var(--text-secondary)' }}>
            当前关卡：{snapshot.levelName}（难度：{snapshot.difficulty}）
          </div>
        </div>
        <div style={{ fontSize: '1.5rem' }}>{hearts}</div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <span className="badge">
          击毁敌军：
          {snapshot.stage === 'idle'
            ? '未开始'
            : snapshot.enemiesRemaining === 0
            ? '全部歼灭'
            : `${snapshot.enemiesRemaining} 辆剩余`}
        </span>
        <span className="badge">得分：{snapshot.score}</span>
        <span className="badge">
          道具状态：
          {snapshot.powerUp.active
            ? `穿透炮弹 (${snapshot.powerUp.remainingTimer.toFixed(1)}s)`
            : '待命'}
        </span>
        <span className={`badge ${snapshot.stage === 'playing' ? 'status-success' : snapshot.stage === 'paused' ? 'status-warning' : 'status-danger'}`}>
          状态：
          {(() => {
            switch (snapshot.stage) {
              case 'playing':
                return '作战中';
              case 'paused':
                return '已暂停';
              case 'levelComplete':
                return '关卡完成';
              case 'gameOver':
                return '任务失败';
              default:
                return '待命';
            }
          })()}
        </span>
      </div>

      {snapshot.statusMessage && (
        <div style={{ color: '#f5d67b', fontSize: '1.1rem', letterSpacing: '0.12em' }}>{snapshot.statusMessage}</div>
      )}
    </div>
  );
}
