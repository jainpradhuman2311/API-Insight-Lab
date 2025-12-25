import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-json';
import 'prismjs/themes/prism.css';

interface CodeEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    language?: string;
    className?: string;
    minHeight?: string;
}

export function CodeEditor({
    value,
    onChange,
    placeholder = '',
    className = '',
    minHeight = '200px'
}: CodeEditorProps) {
    const highlightCode = (code: string) => {
        return highlight(code, languages.json, 'json');
    };

    return (
        <div
            className={`rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 overflow-hidden ${className}`}
            style={{ minHeight }}
        >
            <Editor
                value={value}
                onValueChange={onChange}
                highlight={highlightCode}
                placeholder={placeholder}
                padding={12}
                style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    minHeight,
                }}
                className="code-editor-container"
                textareaClassName="code-editor-textarea"
                preClassName="code-editor-pre"
            />
        </div>
    );
}
