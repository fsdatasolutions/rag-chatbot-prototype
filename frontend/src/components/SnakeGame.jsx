// frontend/src/components/SnakeGame.jsx
import React, { useState, useEffect, useRef } from 'react';
import './SnakeGame.css';

const gridSize = 20;
const initialSnake = [{ x: 8, y: 8 }];
const initialDirection = { x: 1, y: 0 };

const SnakeGame = () => {
    const [snake, setSnake] = useState(initialSnake);
    const [food, setFood] = useState(generateFood(initialSnake));
    const [direction, setDirection] = useState(initialDirection);
    const [isRunning, setIsRunning] = useState(true);
    const [score, setScore] = useState(0);
    const [gameStarted, setGameStarted] = useState(false);
    const [gameKey, setGameKey] = useState(0);
    const intervalRef = useRef();

    const handleStart = () => setGameStarted(true);
    const handleRestart = () => setGameKey(prev => prev + 1);

    useEffect(() => {
        const handleKeyDown = (e) => {
            switch (e.key) {
                case 'ArrowUp':
                    if (direction.y === 0) setDirection({ x: 0, y: -1 });
                    break;
                case 'ArrowDown':
                    if (direction.y === 0) setDirection({ x: 0, y: 1 });
                    break;
                case 'ArrowLeft':
                    if (direction.x === 0) setDirection({ x: -1, y: 0 });
                    break;
                case 'ArrowRight':
                    if (direction.x === 0) setDirection({ x: 1, y: 0 });
                    break;
                default:
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [direction]);

    useEffect(() => {
        if (!gameStarted) return;
        intervalRef.current = setInterval(() => {
            if (!isRunning) return;
            setSnake(prevSnake => {
                const head = { ...prevSnake[0] };
                head.x += direction.x;
                head.y += direction.y;

                if (
                    head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize ||
                    prevSnake.some(seg => seg.x === head.x && seg.y === head.y)
                ) {
                    setIsRunning(false);
                    return prevSnake;
                }

                const newSnake = [head, ...prevSnake];

                if (head.x === food.x && head.y === food.y) {
                    setFood(generateFood(newSnake));
                    setScore(score + 1);
                } else {
                    newSnake.pop();
                }

                return newSnake;
            });
        }, 150);

        return () => clearInterval(intervalRef.current);
    }, [direction, food, isRunning, gameStarted]);

    return (
        <div style={{ textAlign: 'center' }}>
            {!gameStarted ? (
                <button onClick={handleStart} style={{ padding: '10px 20px', fontSize: '16px' }}>
                    Start Snake Game
                </button>
            ) : (
                <>
                    <div className="snake-board">
                        {[...Array(gridSize)].map((_, y) =>
                            [...Array(gridSize)].map((_, x) => {
                                const isSnake = snake.some(seg => seg.x === x && seg.y === y);
                                const isFood = food.x === x && food.y === y;
                                return (
                                    <div
                                        key={`${x}-${y}`}
                                        className={`cell ${isSnake ? 'snake' : ''} ${isFood ? 'food' : ''}`}
                                    />
                                );
                            })
                        )}
                    </div>
                    <div style={{ marginTop: '10px' }}>
                        {isRunning ? `Score: ${score}` : 'Game Over! Press refresh to play again.'}
                    </div>
                    <button onClick={handleRestart} style={{ marginTop: '20px', padding: '8px 16px' }}>
                        Restart Game
                    </button>
                </>
            )}
        </div>
    );
};

function generateFood(snake) {
    let food;
    do {
        food = {
            x: Math.floor(Math.random() * gridSize),
            y: Math.floor(Math.random() * gridSize),
        };
    } while (snake.some(seg => seg.x === food.x && seg.y === food.y));
    return food;
}

export default SnakeGame;