import React, { useState, useEffect, useMemo } from 'react';
    import { Helmet } from 'react-helmet';
    import { motion, AnimatePresence } from 'framer-motion';
    import { useNavigate } from 'react-router-dom';
    import { Button } from '@/components/ui/button';
    import { ChevronLeft, ChevronRight, ArrowLeft, Filter } from 'lucide-react';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import {
      LineChart,
      Line,
      XAxis,
      YAxis,
      CartesianGrid,
      Tooltip,
      Legend,
      ResponsiveContainer
    } from 'recharts';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { startOfMonth, endOfMonth, format, eachDayOfInterval, subDays } from 'date-fns';

    const FluxoCaixa = () => {
      const navigate = useNavigate();
      const { toast } = useToast();
      const [allData, setAllData] = useState([]);
      const [currentDate, setCurrentDate] = useState(new Date());
      const [loading, setLoading] = useState(false);
      const [unidadeFiltro, setUnidadeFiltro] = useState('todas');

      useEffect(() => {
        loadData();
      }, [toast]);

      const loadData = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('lancamentos').select('*');
        if (error) {
          toast({ title: "Erro ao buscar dados", description: error.message, variant: "destructive"});
        } else {
          setAllData(data || []);
        }
        setLoading(false);
      };

      const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
      };

      const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
      };

      const formatCurrency = (value) => {
        return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      };

      const monthData = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
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
          return vencimento.getUTCFullYear() === year && vencimento.getUTCMonth() === month;
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
      }, [allData, currentDate, unidadeFiltro]);

      const chartData = monthData.map(d => ({
        name: d.dia,
        ...d
      }));

      const monthName = currentDate.toLocaleString('pt-BR', { month: 'long', timeZone: 'UTC' });
      const year = currentDate.getFullYear();

      return (
        <>
          <Helmet>
            <title>Fluxo de Caixa Previsto - SysFina</title>
            <meta name="description" content="Análise do fluxo de caixa previsto (valores a vencer)." />
          </Helmet>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="text-white hover:bg-white/10">
                    <ArrowLeft className="w-6 h-6" />
                  </Button>
                  <div>
                    <h1 className="text-3xl font-bold text-white">Fluxo de Caixa Previsto</h1>
                  </div>
                </div>
                <div className="flex items-center gap-4 bg-slate-800/50 p-2 rounded-lg">
                    <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
                        <ChevronLeft className="h-6 w-6 text-white" />
                    </Button>
                    <div className="text-xl font-semibold text-white w-48 text-center capitalize">{`${monthName} ${year}`}</div>
                    <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                        <ChevronRight className="h-6 w-6 text-white" />
                    </Button>
                </div>
            </div>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white"><Filter className="w-5 h-5" />Filtro por Unidade</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={unidadeFiltro} onValueChange={setUnidadeFiltro}>
                  <SelectTrigger className="w-full md:w-72 bg-white/10 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as Unidades</SelectItem>
                    <SelectItem value="CNA Angra dos Reis">CNA Angra dos Reis</SelectItem>
                    <SelectItem value="CNA Mangaratiba">CNA Mangaratiba</SelectItem>
                    <SelectItem value="Casa">Casa</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
            
            <Card className="bg-slate-800/60 border-slate-700 text-white backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Detalhes do Mês</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="p-3">Dia</th>
                        <th className="p-3 text-right text-green-400">A Receber</th>
                        <th className="p-3 text-right text-red-400">A Pagar</th>
                        <th className="p-3 text-right">Saldo do Dia</th>
                        <th className="p-3 text-right">Saldo Acumulado</th>
                      </tr>
                    </thead>
                    <AnimatePresence>
                      <tbody>
                        {loading ? (
                          <tr><td colSpan="5" className="text-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div></td></tr>
                        ) : monthData.length > 0 ? monthData.map((dia, index) => (
                          <motion.tr 
                            key={dia.dia}
                            layout
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            className={`border-b border-slate-800 hover:bg-slate-700/50 ${dia.dia === '00' ? 'bg-yellow-500/10' : ''}`}
                          >
                            <td className={`p-3 font-medium ${dia.dia === '00' ? 'text-yellow-400' : ''}`}>{dia.dia === '00' ? 'Atrasados' : dia.dia}</td>
                            <td className="p-3 text-right font-mono text-green-400">{formatCurrency(dia.receber)}</td>
                            <td className="p-3 text-right font-mono text-red-400">{formatCurrency(dia.pagar)}</td>
                            <td className={`p-3 text-right font-mono ${dia.saldoDia >= 0 ? 'text-blue-300' : 'text-orange-400'}`}>{formatCurrency(dia.saldoDia)}</td>
                            <td className={`p-3 text-right font-mono ${dia.saldoAcumulado >= 0 ? 'text-white' : 'text-red-500'}`}>{formatCurrency(dia.saldoAcumulado)}</td>
                          </motion.tr>
                        )) : (
                          <tr>
                            <td colSpan="5" className="text-center p-8 text-slate-400">
                              Nenhum dado para exibir neste mês.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </AnimatePresence>
                  </table>
                </div>
              </CardContent>
            </Card>
    
            <Card className="bg-slate-800/60 border-slate-700 text-white backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Gráfico de Fluxo de Caixa Acumulado</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                    <XAxis dataKey="name" stroke="rgba(255, 255, 255, 0.7)" />
                    <YAxis stroke="rgba(255, 255, 255, 0.7)" tickFormatter={(value) => `R$${value/1000}k`} />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'rgba(30, 41, 59, 0.9)',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                      }}
                      labelStyle={{ color: '#fff' }}
                      formatter={(value, name) => [formatCurrency(value), name.charAt(0).toUpperCase() + name.slice(1)]}
                    />
                    <Legend wrapperStyle={{ color: '#fff' }} />
                    <Line type="monotone" dataKey="saldoAcumulado" name="Saldo Acumulado" stroke="#38bdf8" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                     <Line type="monotone" dataKey="receber" name="A Receber" stroke="#4ade80" strokeWidth={2} />
                    <Line type="monotone" dataKey="pagar" name="A Pagar" stroke="#f87171" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        </>
      );
    };
    
    export default FluxoCaixa;