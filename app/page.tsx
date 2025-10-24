'use client';

import { useEffect, useMemo, useState } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameHud } from './components/GameHud';
import { useGameEngine } from './components/useGameEngine';
import { DEFAULT_LEVEL_ID, LEVELS } from '../lib/game/levels';

export default function Home() {
  const { canvasRef, snapshot, controls } = useGameEngine();
  const [username, setUsername] = useState('');
  const [selectedLevelId, setSelectedLevelId] = useState<number>(DEFAULT_LEVEL_ID);
  const [hasStarted, setHasStarted] = useState(false);

  const currentLevel = useMemo(() => LEVELS.find((level) => level.id === selectedLevelId), [selectedLevelId]);

  const handleStart = () => {
    if (!username.trim()) return;
    controls.start({ levelId: selectedLevelId, username });
    setHasStarted(true);
  };

  const handleTogglePause = () => {
    if (snapshot.stage === 'paused') {
      controls.resume();
    } else if (snapshot.stage === 'playing') {
      controls.pause();
    }
  };

  const handleReset = () => {
    controls.reset();
    setHasStarted(true);
  };

  const handleNextLevel = () => {
    controls.nextLevel();
    setHasStarted(true);
  };

  useEffect(() => {
    if (snapshot.stage === 'idle') {
      return;
    }

    if (snapshot.levelId && snapshot.levelId !== selectedLevelId) {
      setSelectedLevelId(snapshot.levelId);
    }
  }, [snapshot.levelId, snapshot.stage, selectedLevelId]);

  return (
    <main>
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '2.5rem 1.5rem 4rem',
          display: 'grid',
          gap: '2rem'
        }}
      >
        <header style={{ textAlign: 'center' }}>
          <h1 style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '2.3rem', letterSpacing: '0.35rem' }}>
            像素坦克大战
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '1rem', letterSpacing: '0.08em', fontSize: '1.15rem' }}>
            指挥你的坦克，挑战多重关卡，升级炮弹，保卫基地的荣耀。
          </p>
        </header>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '2rem',
            alignItems: 'start'
          }}
        >
          <div className="pixel-card" style={{ display: 'grid', gap: '1.25rem' }}>
            <div>
              <label htmlFor="username" style={{ display: 'block', marginBottom: '0.5rem', letterSpacing: '0.08em' }}>
                玩家代号
              </label>
              <input
                id="username"
                className="pixel-input"
                placeholder="请输入用户名"
                value={username}
                maxLength={16}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>

            <div>
              <label htmlFor="level" style={{ display: 'block', marginBottom: '0.5rem', letterSpacing: '0.08em' }}>
                选择关卡
              </label>
              <select
                id="level"
                className="pixel-input"
                value={selectedLevelId}
                onChange={(event) => setSelectedLevelId(Number(event.target.value))}
              >
                {LEVELS.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}（{level.difficulty}）
                  </option>
                ))}
              </select>
            </div>

            {currentLevel && (
              <div
                style={{
                  padding: '1rem',
                  border: '3px dashed rgba(90, 132, 197, 0.4)',
                  borderRadius: '10px',
                  background: 'rgba(7, 12, 19, 0.6)' 
                }}
              >
                <h3 style={{ marginBottom: '0.5rem', letterSpacing: '0.08em', fontSize: '1.1rem', color: 'var(--accent)' }}>
                  关卡情报
                </h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{currentLevel.description}</p>
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <button
                className="pixel-button"
                style={{ opacity: username.trim() ? 1 : 0.5 }}
                disabled={!username.trim()}
                onClick={handleStart}
              >
                {hasStarted ? '重新开始' : '开始游戏'}
              </button>

              <button
                className="pixel-button"
                onClick={handleTogglePause}
                disabled={!hasStarted}
                style={{
                  background: snapshot.stage === 'paused' ? '#5dd39e' : '#f7b32b',
                  color: '#0d121a'
                }}
              >
                {snapshot.stage === 'paused' ? '继续游戏' : '暂停游戏'}
              </button>

              <button className="pixel-button" onClick={handleReset} disabled={!hasStarted}>
                重置当前关
              </button>

              <button
                className="pixel-button"
                onClick={handleNextLevel}
                disabled={snapshot.stage !== 'levelComplete'}
                style={{ background: '#6affca', color: '#0d121a' }}
              >
                下一关
              </button>
            </div>

            <div style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: 1.8 }}>
              <p>WASD / 方向键：移动坦克</p>
              <p>空格：发射炮弹</p>
              <p>普通炮弹会被墙体阻挡；拾取黄色道具后可短时间穿墙射击。</p>
              <p>黄色道具提供穿墙与强化火力，绿色维修包可恢复生命，红色地雷会造成伤害。</p>
            </div>
          </div>

          <div style={{ display: 'grid', justifyItems: 'center', gap: '1rem' }}>
            <GameCanvas ref={canvasRef} />
            <GameHud snapshot={snapshot} />
          </div>
        </section>
      </div>
    </main>
  );
}
