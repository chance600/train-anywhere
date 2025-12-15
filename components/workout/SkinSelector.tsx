import React from 'react';
import { Palette, Flame, Snowflake, Zap, Sparkles, Moon, Sun } from 'lucide-react';

export interface WorkoutSkin {
    id: string;
    name: string;
    icon: React.ReactNode;
    className: string;
    overlay?: string; // CSS for canvas overlay effects
    celebrationColor?: string;
}

export const WORKOUT_SKINS: WorkoutSkin[] = [
    {
        id: 'default',
        name: 'Default',
        icon: <Palette size={18} />,
        className: '',
        celebrationColor: '#10B981'
    },
    {
        id: 'neon',
        name: 'Neon',
        icon: <Zap size={18} />,
        className: 'skin-neon',
        celebrationColor: '#00FF88'
    },
    {
        id: 'fire',
        name: 'Fire',
        icon: <Flame size={18} />,
        className: 'skin-fire',
        celebrationColor: '#FF4500'
    },
    {
        id: 'ice',
        name: 'Ice',
        icon: <Snowflake size={18} />,
        className: 'skin-ice',
        celebrationColor: '#00D4FF'
    },
    {
        id: 'retro',
        name: 'Retro',
        icon: <Sparkles size={18} />,
        className: 'skin-retro',
        celebrationColor: '#FF69B4'
    },
    {
        id: 'dark',
        name: 'Stealth',
        icon: <Moon size={18} />,
        className: 'skin-dark',
        celebrationColor: '#8B5CF6'
    },
    {
        id: 'golden',
        name: 'Golden',
        icon: <Sun size={18} />,
        className: 'skin-golden',
        celebrationColor: '#FFD700'
    }
];

interface SkinSelectorProps {
    currentSkin: string;
    onSelectSkin: (skinId: string) => void;
}

const SkinSelector: React.FC<SkinSelectorProps> = ({ currentSkin, onSelectSkin }) => {
    return (
        <div className="flex items-center gap-2 p-2 bg-black/30 backdrop-blur-sm rounded-xl">
            <span className="text-xs text-white/60 mr-1">Theme:</span>
            {WORKOUT_SKINS.map((skin) => (
                <button
                    key={skin.id}
                    onClick={() => onSelectSkin(skin.id)}
                    className={`p-2 rounded-lg transition-all ${currentSkin === skin.id
                            ? 'bg-white/20 text-white ring-2 ring-white/50'
                            : 'text-white/60 hover:text-white hover:bg-white/10'
                        }`}
                    title={skin.name}
                >
                    {skin.icon}
                </button>
            ))}
        </div>
    );
};

export default SkinSelector;
