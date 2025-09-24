import React from 'react';
    import { useNavigate } from 'react-router-dom';
    import { Helmet } from 'react-helmet';
    import { motion } from 'framer-motion';
    import { BarChart3, PieChart, TrendingUp, ArrowLeft } from 'lucide-react';
    
    import { Button } from '@/components/ui/button';
    import { Card, CardContent } from '@/components/ui/card';
    
    const Relatorios = () => {
        const navigate = useNavigate();
    
        const handleNavigation = (path) => {
            navigate(path);
        };
    
        const reportOptions = [
            {
                title: "Fluxo de Caixa Detalhado",
                icon: BarChart3,
                description: "Análise detalhada de entradas e saídas por período.",
                action: () => handleNavigation('/relatorios/fluxo-caixa-detalhado'),
            },
            {
                title: "DRE Gerencial",
                icon: PieChart,
                description: "Demonstrativo de Resultado do Exercício para visão de lucro.",
                action: () => handleNavigation('/relatorios/dre-gerencial'),
            },
            {
                title: "Contas a Pagar/Receber",
                icon: TrendingUp,
                description: "Relatório completo de contas em aberto, pagas e vencidas.",
                action: () => handleNavigation('/relatorios/contas'),
            }
        ];
    
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
            >
                <Helmet>
                    <title>Central de Relatórios - SysFina</title>
                    <meta name="description" content="Gere relatórios financeiros detalhados." />
                </Helmet>
    
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => navigate('/')}>
                            <ArrowLeft className="h-5 w-5" />
                            <span className="sr-only">Voltar</span>
                        </Button>
                        <h1 className="text-3xl font-bold gradient-text">Central de Relatórios</h1>
                    </div>
                </div>
    
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {reportOptions.map((option, index) => {
                        const Icon = option.icon;
                        return (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2 + index * 0.1 }}
                            >
                                <Card 
                                    className="glass-card h-full flex flex-col justify-between hover:border-blue-500 transition-colors duration-300 cursor-pointer"
                                    onClick={option.action}
                                >
                                    <CardContent className="p-6 flex flex-col items-center text-center">
                                        <div className="p-4 bg-blue-500/10 rounded-full mb-4">
                                            <Icon className="w-12 h-12 text-blue-400" />
                                        </div>
                                        <h2 className="text-xl font-semibold text-white mb-2">{option.title}</h2>
                                        <p className="text-gray-400 text-sm flex-grow">{option.description}</p>
                                    </CardContent>
                                    <div className="p-4 pt-0">
                                         <Button className="w-full bg-blue-600 hover:bg-blue-700">Gerar Relatório</Button>
                                    </div>
                                </Card>
                            </motion.div>
                        );
                    })}
                </div>
            </motion.div>
        );
    };
    
    export default Relatorios;