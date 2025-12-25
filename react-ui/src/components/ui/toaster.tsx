
import { useToast } from '@/hooks/use-toast'
import { AlertCircle, CheckCircle, Info, X, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Toaster() {
    const { toasts, dismiss } = useToast()

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={cn(
                        "flex items-start gap-3 p-4 rounded-lg shadow-lg border transition-all duration-300 animate-in slide-in-from-right-full",
                        toast.type === 'success' && "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/10 dark:border-emerald-900/20 dark:text-emerald-300",
                        toast.type === 'error' && "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/10 dark:border-red-900/20 dark:text-red-300",
                        toast.type === 'warning' && "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/10 dark:border-amber-900/20 dark:text-amber-300",
                        toast.type === 'info' && "bg-white border-zinc-200 text-zinc-800 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-300"
                    )}
                >
                    {toast.type === 'success' && <CheckCircle className="w-5 h-5 shrink-0 text-emerald-500" />}
                    {toast.type === 'error' && <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />}
                    {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />}
                    {toast.type === 'info' && <Info className="w-5 h-5 shrink-0 text-indigo-500" />}

                    <div className="flex-1">
                        {toast.title && <h4 className="font-semibold text-sm">{toast.title}</h4>}
                        {toast.description && <p className="text-sm opacity-90 mt-1">{toast.description}</p>}
                    </div>

                    <button
                        onClick={() => dismiss(toast.id)}
                        className="shrink-0 p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    )
}
