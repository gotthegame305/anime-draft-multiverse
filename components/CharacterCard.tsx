import Image from 'next/image';

interface Character {
    id: number;
    name: string;
    imageUrl: string;
    animeUniverse: string;
    stats: {
        favorites?: number;
        roleStats?: any;
        [key: string]: any;
    };
}

interface CharacterCardProps {
    character: Character;
    isSelected?: boolean;
    onSelect?: (character: Character) => void;
    disabled?: boolean;
    hideStats?: boolean;
}

export default function CharacterCard({ character, isSelected, onSelect, disabled, hideStats = false }: CharacterCardProps) {
    const stats = character.stats as { power?: number; intelligence?: number; speed?: number; favorites?: number };

    return (
        <div
            onClick={() => !disabled && onSelect && onSelect(character)}
            className={`
        relative group cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-300
        ${isSelected
                    ? 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)] scale-105 z-10'
                    : 'border-slate-700 bg-slate-800 hover:border-blue-500 hover:shadow-[0_0_15px_rgba(59,130,246,0.5)] hover:-translate-y-1'
                }
        ${disabled ? 'opacity-50 grayscale cursor-not-allowed hover:transform-none' : ''}
      `}
        >
            {/* Image Container */}
            <div className="relative aspect-[3/4] w-full overflow-hidden">
                <Image
                    src={character.imageUrl}
                    alt={character.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80" />

                {/* Content */}
                <div className="absolute bottom-0 left-0 w-full p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-1">
                        {character.animeUniverse}
                    </p>
                    <h3 className="text-xl font-black text-white leading-tight mb-2">
                        {character.name}
                    </h3>

                    {/* Stats / Info */}
                    {!hideStats && (
                        <div className="flex gap-2 text-[10px] text-gray-300 font-mono">
                            {stats.favorites && (
                                <span className="bg-slate-700/50 px-2 py-1 rounded backdrop-blur-sm border border-slate-600">
                                    ❤️ {stats.favorites.toLocaleString()}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Selected Indicator */}
            {isSelected && (
                <div className="absolute top-2 right-2 bg-yellow-400 text-black font-bold p-1 rounded-full shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                </div>
            )}
        </div>
    );
}
