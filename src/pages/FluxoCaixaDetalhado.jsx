import React, { useState, useEffect, useRef, useMemo } from 'react';
    import { Helmet } from 'react-helmet';
    import { motion } from 'framer-motion';
    import { useNavigate } from 'react-router-dom';
    import { ArrowLeft, FileDown, Printer, Filter } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { format, startOfMonth, endOfMonth, eachMonthOfInterval, eachDayOfInterval } from 'date-fns';
    import { ptBR } from 'date-fns/locale';
    import jsPDF from 'jspdf';
    import html2canvas from 'html2canvas';

    const FluxoCaixaDetalhado = () => {
        const navigate = useNavigate();
        const { toast } = useToast();
        const [allData, setAllData] = useState([]);
        const [competencias, setCompetencias] = useState([]);
        const [selectedCompetencia, setSelectedCompetencia] = useState('');
        const [unidadeFiltro, setUnidadeFiltro] = useState('todas');
        const [reportData, setReportData] = useState(null);
        const [loading, setLoading] = useState(false);
        const reportRef = useRef();

        useEffect(() => {
            const fetchInitialData = async () => {
                const { data, error } = await supabase
                    .from('lancamentos')
                    .select('data, status, tipo, valor, unidade, datapag')
                    .order('data', { ascending: true });

                if (error) {
                    toast({ title: "Erro ao carregar dados iniciais", description: error.message, variant: "destructive" });
                    return;
                }
                
                setAllData(data || []);

                if (!data || data.length === 0) {
                    const now = new Date();
                    const currentCompetencia = format(now, 'yyyy-MM');
                    setCompetencias([currentCompetencia]);
                    setSelectedCompetencia(currentCompetencia);
                    return;
                }

                const firstDate = new Date(data[0].data + 'T00:00:00');
                const lastDate = new Date(data[data.length - 1].data + 'T00:00:00');
                
                const interval = eachMonthOfInterval({
                    start: firstDate,
                    end: lastDate
                });

                const comps = interval.map(date => format(date, 'yyyy-MM')).reverse();
                setCompetencias(comps);
                if (comps.length > 0) {
                    setSelectedCompetencia(comps[0]);
                }
            };

            fetchInitialData();
        }, [toast]);

        const formatCurrency = (value) => {
            return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        };

        const monthData = useMemo(() => {
            if (!selectedCompetencia) return null;

            const [year, month] = selectedCompetencia.split('-');
            const currentDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            const firstDayOfMonth = startOfMonth(currentDate);
            const lastDayOfMonth = endOfMonth(currentDate);
            const daysInMonth = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });

            let fluxo = daysInMonth.map(day => ({
              dia: format(day, 'dd'),
              receber: 0,
              pagar: 0,
            }));

            const filteredByUnit = unidadeFiltro === 'todas' 
              ? allData 
              : allData.filter(item => item.unidade === unidadeFiltro);

            const atrasados = filteredByUnit.filter(item => {
              if (item.status === 'Pago') return false;
              const vencimento = new Date(item.data + 'T00:00:00');
              return vencimento < firstDayOfMonth;
            });

            const dia00 = {
              dia: '00',
              receber: atrasados.filter(i => i.tipo === 'Entrada').reduce((acc, i) => acc + i.valor, 0),
              pagar: atrasados.filter(i => i.tipo === 'Saida').reduce((acc, i) => acc + i.valor, 0),
            };

            const monthDataFiltered = filteredByUnit.filter(item => {
              if (item.status === 'Pago') return false;
              const vencimento = new Date(item.data + 'T00:00:00');
              return vencimento.getUTCFullYear() === parseInt(year) && vencimento.getUTCMonth() === parseInt(month) - 1;
            });

            monthDataFiltered.forEach(item => {
              const vencimento = new Date(item.data + 'T00:00:00');
              const dayIndex = vencimento.getUTCDate() - 1;
              if (fluxo[dayIndex]) {
                const type = item.tipo === 'Entrada' ? 'receber' : 'pagar';
                fluxo[dayIndex][type] += item.valor;
              }
            });

            const fullFluxo = [dia00, ...fluxo];

            let saldoAcumulado = 0;
            return fullFluxo.map(dia => {
              const saldoDia = dia.receber - dia.pagar;
              saldoAcumulado += saldoDia;
              return { ...dia, saldoDia, saldoAcumulado };
            });
        }, [allData, selectedCompetencia, unidadeFiltro]);

        const handleGenerateReport = () => {
            if (!monthData) {
                toast({ title: "Selecione uma competência", variant: "destructive" });
                return;
            }
            setLoading(true);
            const [year, month] = selectedCompetencia.split('-');
            const competenciaDate = new Date(parseInt(year), parseInt(month) - 1, 1);

            const totalEntradas = monthData.reduce((acc, item) => acc + item.receber, 0);
            const totalSaidas = monthData.reduce((acc, item) => acc + item.pagar, 0);

            setReportData({
                daily: monthData,
                totalEntradas,
                totalSaidas,
                resultado: totalEntradas - totalSaidas,
                competencia: format(competenciaDate, 'MMMM/yyyy', { locale: ptBR })
            });
            setLoading(false);
        };

        const handleDownloadPdf = () => {
            const input = reportRef.current;
            if (!input) return;

            html2canvas(input, { scale: 2, backgroundColor: '#ffffff' }).then(canvas => {
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const canvasWidth = canvas.width;
                const canvasHeight = canvas.height;
                const ratio = canvasHeight / canvasWidth;
                let imgHeight = pdfWidth * ratio;
                let heightLeft = imgHeight;
                let position = 10;
                
                pdf.addImage(imgData, 'PNG', 10, position, pdfWidth-20, imgHeight);
                heightLeft -= (pdfHeight - 20);

                while (heightLeft >= 0) {
                  position = heightLeft - imgHeight + 10;
                  pdf.addPage();
                  pdf.addImage(imgData, 'PNG', 10, position, pdfWidth - 20, imgHeight);
                  heightLeft -= pdfHeight;
                }

                pdf.save(`fluxo_caixa_previsto_${selectedCompetencia}.pdf`);
            });
        };

        const handlePrint = () => {
             const printContent = reportRef.current.innerHTML;
             const printWindow = window.open('', '_blank');
             printWindow.document.write(`
                <html>
                  <head>
                    <title>Imprimir Relatório</title>
                    <style>
                      body { background-color: #ffffff; color: #0f172a; font-family: sans-serif; margin: 20px; }
                      table { width: 100%; border-collapse: collapse; font-size: 12px; }
                      th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
                      th { background-color: #f1f5f9; }
                      .text-green-600 { color: #16a34a; }
                      .text-red-600 { color: #dc2626; }
                      .font-mono { font-family: monospace; }
                      .text-right { text-align: right; }
                      .font-bold { font-weight: bold; }
                      .text-lg { font-size: 1.125rem; }
                      .text-2xl { font-size: 1.5rem; }
                      .capitalize { text-transform: capitalize; }
                      .mb-6 { margin-bottom: 1.5rem; }
                      .mt-8 { margin-top: 2rem; }
                      .pt-4 { padding-top: 1rem; }
                      .border-t { border-top-width: 1px; }
                      .flex { display: flex; }
                      .justify-between { justify-content: space-between; }
                      .w-full { width: 100%; }
                      .max-w-sm { max-width: 24rem; }
                      .space-y-2 > * + * { margin-top: 0.5rem; }
                    </style>
                  </head>
                  <body>${printContent}</body>
                </html>
             `);
             printWindow.document.close();
             printWindow.focus();
             setTimeout(() => {
                printWindow.print();
                printWindow.close();
             }, 500);
        };

        return (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                <Helmet>
                    <title>Relatório de Fluxo de Caixa Previsto - SysFina</title>
                </Helmet>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => navigate('/relatorios')}>
                            <ArrowLeft className="h-5 w-5" />
                            <span className="sr-only">Voltar</span>
                        </Button>
                        <h1 className="text-3xl font-bold gradient-text">Relatório de Fluxo de Caixa (Previsto)</h1>
                    </div>
                </div>

                <Card className="glass-card">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2"><Filter className="w-5 h-5" />Filtros</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="w-full sm:w-auto sm:flex-grow">
                            <label className="text-sm text-gray-300 mb-2 block">Competência</label>
                            <Select onValueChange={setSelectedCompetencia} value={selectedCompetencia}>
                                <SelectTrigger><SelectValue placeholder="Selecione a competência" /></SelectTrigger>
                                <SelectContent>
                                    {competencias.map(comp => (
                                        <SelectItem key={comp} value={comp}>
                                            {format(new Date(comp + '-02'), 'MMMM/yyyy', { locale: ptBR })}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-full sm:w-auto sm:flex-grow">
                            <label className="text-sm text-gray-300 mb-2 block">Unidade</label>
                            <Select value={unidadeFiltro} onValueChange={setUnidadeFiltro}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todas">Todas as Unidades</SelectItem>
                                    <SelectItem value="CNA Angra dos Reis">CNA Angra dos Reis</SelectItem>
                                    <SelectItem value="CNA Mangaratiba">CNA Mangaratiba</SelectItem>
                                    <SelectItem value="Casa">Casa</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="self-end">
                            <Button onClick={handleGenerateReport} disabled={loading || !selectedCompetencia} className="w-full sm:w-auto">
                                {loading ? 'Gerando...' : 'Gerar Relatório'}
                            </Button>
                        </div>
                        {reportData && (
                            <div className="self-end flex gap-2">
                                <Button variant="outline" onClick={handleDownloadPdf} className="w-full sm:w-auto">
                                    <FileDown className="mr-2 h-4 w-4" /> PDF
                                </Button>
                                <Button variant="outline" onClick={handlePrint} className="w-full sm:w-auto">
                                    <Printer className="mr-2 h-4 w-4" /> Imprimir
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {reportData && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div ref={reportRef} className="bg-white text-slate-800 p-6 rounded-lg">
                            <div className="text-center mb-6">
                                <h2 className="text-2xl font-bold">Fluxo de Caixa Previsto</h2>
                                <p className="text-lg capitalize">{reportData.competencia}</p>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b-2 border-slate-300">
                                            <th className="py-2 pr-2 text-left">Dia</th>
                                            <th className="py-2 pr-2 text-right">A Receber</th>
                                            <th className="py-2 pr-2 text-right">A Pagar</th>
                                            <th className="py-2 pr-2 text-right">Saldo Dia</th>
                                            <th className="py-2 pr-2 text-right">Saldo Acumulado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.daily.length > 0 ? reportData.daily.map(day => (
                                            <tr key={day.dia} className="border-b border-slate-200">
                                                <td className="py-2 pr-2 font-bold">{day.dia === '00' ? 'Atrasados' : day.dia}</td>
                                                <td className="py-2 text-right font-mono text-green-600">{formatCurrency(day.receber)}</td>
                                                <td className="py-2 text-right font-mono text-red-600">{formatCurrency(day.pagar)}</td>
                                                <td className={`py-2 text-right font-mono ${day.saldoDia >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{formatCurrency(day.saldoDia)}</td>
                                                <td className={`py-2 text-right font-mono ${day.saldoAcumulado >= 0 ? 'text-slate-800' : 'text-red-600'}`}>{formatCurrency(day.saldoAcumulado)}</td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="5" className="text-center py-8 text-slate-500">Nenhuma transação encontrada para esta competência e filtro.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-8 pt-4 border-t border-slate-300">
                                <div className="flex justify-end">
                                    <div className="w-full max-w-sm space-y-2 text-right">
                                        <div className="flex justify-between"><span>Total de Entradas:</span> <span className="font-mono text-green-600">{formatCurrency(reportData.totalEntradas)}</span></div>
                                        <div className="flex justify-between"><span>Total de Saídas:</span> <span className="font-mono text-red-600">{formatCurrency(reportData.totalSaidas)}</span></div>
                                        <div className={`flex justify-between font-bold text-lg pt-2 border-t border-slate-300 ${reportData.resultado >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                                            <span>Resultado do Mês:</span>
                                            <span className="font-mono">{formatCurrency(reportData.resultado)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </motion.div>
        );
    };

    export default FluxoCaixaDetalhado;