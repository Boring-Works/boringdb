import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/button/button';
import { CodeSnippet } from '@/components/code-snippet/code-snippet';
import { Spinner } from '@/components/spinner/spinner';
import type { DatabaseType } from '@/lib/domain/database-type';
import {
    generateDiagramFromPrompt,
    fixDBMLSyntax,
} from '@/lib/data/ai-diagram/generate-diagram-from-prompt';
import { detectImportMethod } from '@/lib/import-method/detect-import-method';
import { Sparkles, ArrowLeft, Play, Eraser, Check } from 'lucide-react';
import { useMonaco } from '@monaco-editor/react';
import { setupDBMLLanguage } from '@/components/code-snippet/languages/dbml-language';
import {
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogInternalContent,
    DialogTitle,
} from '@/components/dialog/dialog';
import { useToast } from '@/components/toast/use-toast';

/** Strip markdown code fences that the model may wrap DBML in */
function stripCodeFences(text: string): string {
    return text
        .replace(/^```[\w]*\n?/gm, '')
        .replace(/```\s*$/gm, '')
        .trim();
}

export interface AIGenerateStepProps {
    databaseType: DatabaseType;
    onBack: () => void;
    onImport: (dbml: string) => Promise<void> | void;
    onImportSQL?: (sql: string) => Promise<void> | void;
}

export const AIGenerateStep: React.FC<AIGenerateStepProps> = ({
    databaseType,
    onBack,
    onImport,
    onImportSQL,
}) => {
    const { toast } = useToast();
    const [prompt, setPrompt] = useState('');
    const [dbml, setDbml] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const monaco = useMonaco();

    useEffect(() => {
        if (monaco) {
            setupDBMLLanguage(monaco);
        }
    }, [monaco]);

    const handleGenerate = useCallback(async () => {
        if (!prompt.trim()) return;

        setDbml('');
        setIsGenerating(true);
        setIsComplete(false);

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        try {
            await generateDiagramFromPrompt({
                prompt,
                databaseType,
                onResultStream: (text) => {
                    setDbml((prev) => prev + text);
                },
                signal: abortControllerRef.current.signal,
            });
            setIsComplete(true);
        } catch (error: unknown) {
            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }
            toast({
                title: 'Generation failed',
                description: 'Failed to generate schema. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsGenerating(false);
        }
    }, [prompt, databaseType, toast]);

    const handleImport = useCallback(async () => {
        const stripped = stripCodeFences(dbml);
        const format = detectImportMethod(stripped);
        console.log('[AI Diagram] Detected format:', format);

        setIsImporting(true);
        try {
            if (format === 'ddl' && onImportSQL) {
                // AI generated SQL instead of DBML — route through SQL importer
                console.log('[AI Diagram] Routing through SQL importer');
                await onImportSQL(stripped);
            } else {
                // DBML path (default)
                const cleaned = fixDBMLSyntax(stripped);
                console.log(
                    '[AI Diagram] Cleaned DBML for import:',
                    cleaned.substring(0, 200)
                );
                await onImport(cleaned);
            }
        } catch (error: unknown) {
            console.error('[AI Diagram] Import error:', error);
            // @dbml/core throws CompilerError which is NOT an Error instance
            // It has a .diags array with parse error details
            let message = 'Invalid schema';
            if (error instanceof Error) {
                message = error.message;
            } else if (error && typeof error === 'object' && 'diags' in error) {
                type Diag = { message: string };
                const diags = (error as { diags: Diag[] }).diags;
                if (Array.isArray(diags)) {
                    message = diags.map((d) => d.message).join('; ');
                }
            }
            toast({
                title: 'Import failed',
                description: `Could not create diagram: ${message}. Try regenerating.`,
                variant: 'destructive',
            });
        } finally {
            setIsImporting(false);
        }
    }, [dbml, onImport, onImportSQL, toast]);

    const handleClear = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setPrompt('');
        setDbml('');
        setIsComplete(false);
        setIsGenerating(false);
    }, []);

    return (
        <>
            <DialogHeader>
                <DialogTitle>
                    <div className="flex items-center gap-2">
                        <Sparkles className="size-5 text-pink-600" />
                        Generate with AI
                    </div>
                </DialogTitle>
                <DialogDescription>
                    Describe the database you want to create and AI will
                    generate a schema for you.
                </DialogDescription>
            </DialogHeader>
            <DialogInternalContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">
                        Describe your database:
                    </label>
                    <textarea
                        className="flex max-h-[80px] min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="e.g., An e-commerce system with users, products, orders, reviews, and categories. Include a wishlist and shipping addresses."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        disabled={isGenerating}
                        maxLength={2000}
                    />
                    <div className="flex gap-2">
                        <Button
                            className="flex-1"
                            onClick={handleGenerate}
                            disabled={isGenerating || !prompt.trim()}
                        >
                            {isGenerating ? (
                                <>
                                    <Spinner className="mr-2 size-4" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Play className="mr-2 size-4" />
                                    Generate DBML
                                </>
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleClear}
                            disabled={!prompt && !dbml}
                        >
                            <Eraser className="size-4" />
                        </Button>
                    </div>
                </div>
                {dbml && (
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">
                            Generated DBML:
                        </label>
                        <CodeSnippet
                            className="h-[50vh] min-h-[300px] w-full"
                            code={dbml}
                            language="dbml"
                            autoScroll={!isComplete}
                            isComplete={isComplete}
                            editorProps={{
                                height: '100%',
                                options: {
                                    scrollbar: {
                                        vertical: 'auto',
                                        horizontal: 'auto',
                                    },
                                    wordWrap: 'on',
                                    fontSize: 13,
                                },
                            }}
                        />
                    </div>
                )}
            </DialogInternalContent>
            <DialogFooter className="mt-4 flex !justify-between gap-2">
                <Button variant="ghost" onClick={onBack}>
                    <ArrowLeft className="mr-2 size-4" />
                    Back
                </Button>
                <Button
                    disabled={!isComplete || !dbml.trim() || isImporting}
                    onClick={handleImport}
                >
                    {isImporting ? (
                        <>
                            <Spinner className="mr-2 size-4" />
                            Creating...
                        </>
                    ) : (
                        <>
                            <Check className="mr-2 size-4" />
                            Create Diagram
                        </>
                    )}
                </Button>
            </DialogFooter>
        </>
    );
};
