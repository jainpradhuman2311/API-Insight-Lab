import { Highlight, themes } from 'prism-react-renderer';
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type CodeTheme = 'nightOwl' | 'dracula' | 'github' | 'vsDark' | 'oneDark';

interface CodeSnippetProps {
    code: string;
    language?: 'json' | 'javascript' | 'html' | 'bash' | 'markup';
    showLineNumbers?: boolean;
    showCopyButton?: boolean;
    maxHeight?: string;
    title?: string;
    theme?: CodeTheme;
}

const themeMap = {
    nightOwl: themes.nightOwl,
    dracula: themes.dracula,
    github: themes.github,
    vsDark: themes.vsDark,
    oneDark: themes.oneDark,
};

export function CodeSnippet({
    code,
    language = 'json',
    showLineNumbers = true,
    showCopyButton = true,
    maxHeight = '400px',
    title,
    theme = 'nightOwl'
}: CodeSnippetProps) {
    const [copied, setCopied] = useState(false);
    const selectedTheme = themeMap[theme] || themes.nightOwl;

    const handleCopy = async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="rounded-lg overflow-hidden border border-zinc-800 bg-[#1e1e2e]">
            {/* Header Bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/80 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/80" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                        <div className="w-3 h-3 rounded-full bg-green-500/80" />
                    </div>
                    {title && (
                        <span className="text-xs text-zinc-400 ml-2 font-medium">{title}</span>
                    )}
                </div>
                {showCopyButton && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-zinc-400 hover:text-white hover:bg-zinc-700"
                        onClick={handleCopy}
                    >
                        {copied ? (
                            <>
                                <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                                <span className="text-xs text-emerald-400">Copied!</span>
                            </>
                        ) : (
                            <>
                                <Copy className="w-3.5 h-3.5 mr-1" />
                                <span className="text-xs">Copy</span>
                            </>
                        )}
                    </Button>
                )}
            </div>

            {/* Code Block */}
            <div className="overflow-auto" style={{ maxHeight }}>
                <Highlight theme={selectedTheme} code={code.trim()} language={language}>
                    {({ className, style, tokens, getLineProps, getTokenProps }) => (
                        <pre
                            className={`${className} p-4 text-sm font-mono leading-relaxed m-0`}
                            style={{ ...style, background: 'transparent' }}
                        >
                            {tokens.map((line, i) => (
                                <div key={i} {...getLineProps({ line })} className="table-row">
                                    {showLineNumbers && (
                                        <span className="table-cell pr-4 text-right select-none text-zinc-600 text-xs w-8">
                                            {i + 1}
                                        </span>
                                    )}
                                    <span className="table-cell">
                                        {line.map((token, key) => (
                                            <span key={key} {...getTokenProps({ token })} />
                                        ))}
                                    </span>
                                </div>
                            ))}
                        </pre>
                    )}
                </Highlight>
            </div>
        </div>
    );
}
