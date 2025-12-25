
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Trash2 } from 'lucide-react'
import type { Assertion } from '../types'

interface AssertionBuilderProps {
    assertions: Assertion[]
    setAssertions: (assertions: Assertion[]) => void
}

export function AssertionBuilder({ assertions, setAssertions }: AssertionBuilderProps) {
    const addAssertion = () => {
        setAssertions([...assertions, {
            assertion_type: 'status_code',
            operator: 'equals',
            expected_value: '200',
            enabled: true
        }])
    }

    const updateAssertion = (index: number, field: string, value: any) => {
        const updated = [...assertions]
        updated[index] = { ...updated[index], [field]: value }
        setAssertions(updated)
    }

    const removeAssertion = (index: number) => {
        setAssertions(assertions.filter((_, i) => i !== index))
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Assertions</Label>
                <Button onClick={addAssertion} size="sm" variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Assertion
                </Button>
            </div>

            {assertions.length === 0 && (
                <p className="text-sm text-zinc-500 text-center py-4 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
                    No assertions defined. Add assertions to validate responses automatically.
                </p>
            )}

            {assertions.map((assertion, index) => (
                <Card key={index} className="border-zinc-200 dark:border-zinc-800">
                    <CardContent className="p-4">
                        <div className="grid grid-cols-12 gap-3 items-end">
                            {/* Assertion Type */}
                            <div className="col-span-3">
                                <Label className="text-xs text-zinc-600 dark:text-zinc-400">Type</Label>
                                <Select
                                    value={assertion.assertion_type}
                                    onValueChange={(val: any) => updateAssertion(index, 'assertion_type', val)}
                                >
                                    <SelectTrigger className="h-9 text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="status_code">Status Code</SelectItem>
                                        <SelectItem value="response_time">Response Time</SelectItem>
                                        <SelectItem value="json_path">JSON Path</SelectItem>
                                        <SelectItem value="header">Header</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Field Path (for JSON & Header) */}
                            {(assertion.assertion_type === 'json_path' || assertion.assertion_type === 'header') && (
                                <div className="col-span-3">
                                    <Label className="text-xs text-zinc-600 dark:text-zinc-400">
                                        {assertion.assertion_type === 'json_path' ? 'JSON Path' : 'Header Name'}
                                    </Label>
                                    <Input
                                        className="h-9 text-sm font-mono"
                                        placeholder={assertion.assertion_type === 'json_path' ? '$.data.id' : 'Content-Type'}
                                        value={assertion.field_path || ''}
                                        onChange={(e) => updateAssertion(index, 'field_path', e.target.value)}
                                    />
                                </div>
                            )}

                            {/* Operator */}
                            <div className={assertion.assertion_type === 'status_code' || assertion.assertion_type === 'response_time' ? 'col-span-3' : 'col-span-2'}>
                                <Label className="text-xs text-zinc-600 dark:text-zinc-400">Operator</Label>
                                <Select
                                    value={assertion.operator}
                                    onValueChange={(val) => updateAssertion(index, 'operator', val)}
                                >
                                    <SelectTrigger className="h-9 text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="equals">Equals (=)</SelectItem>
                                        <SelectItem value="neq">Not Equals (!=)</SelectItem>
                                        <SelectItem value="contains">Contains</SelectItem>
                                        <SelectItem value="gt">Greater Than (&gt;)</SelectItem>
                                        <SelectItem value="lt">Less Than (&lt;)</SelectItem>
                                        <SelectItem value="gte">Greater Than or Equal (&ge;)</SelectItem>
                                        <SelectItem value="lte">Less Than or Equal (&le;)</SelectItem>
                                        {assertion.assertion_type === 'json_path' && (
                                            <>
                                                <SelectItem value="exists">Exists</SelectItem>
                                                <SelectItem value="not_exists">Not Exists</SelectItem>
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Expected Value */}
                            {assertion.operator !== 'exists' && assertion.operator !== 'not_exists' && (
                                <div className={assertion.assertion_type === 'status_code' || assertion.assertion_type === 'response_time' ? 'col-span-4' : 'col-span-3'}>
                                    <Label className="text-xs text-zinc-600 dark:text-zinc-400">Expected Value</Label>
                                    <Input
                                        className="h-9 text-sm font-mono"
                                        placeholder={assertion.assertion_type === 'response_time' ? '500' : '200'}
                                        value={assertion.expected_value}
                                        onChange={(e) => updateAssertion(index, 'expected_value', e.target.value)}
                                    />
                                </div>
                            )}

                            {/* Delete Button */}
                            <div className="col-span-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                    onClick={() => removeAssertion(index)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
