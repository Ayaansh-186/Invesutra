import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import type { PortfolioAnalysis, Fund } from "@/lib/types";

// react-pdf ships without Helvetica's bold/oblique metrics registered by
// default in some environments — register the standard family explicitly so
// bold headings render correctly across platforms.
Font.register({
  family: "Helvetica",
  fonts: [{ src: "Helvetica" }],
});

export interface ReportPdfIssue {
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
}

export interface ReportPdfData {
  id: string;
  generatedAt: string;
  portfolio: string;
  healthScore: number;
  overallHealth: PortfolioAnalysis["overallHealth"];
  summary: string;
  analysis: PortfolioAnalysis;
  funds: Fund[];
  riskMetrics: PortfolioAnalysis["riskMetrics"];
  issues: ReportPdfIssue[];
  recommendations: string[];
  algorithmExplanation: string;
}

const COLORS = {
  ink: "#0f172a",
  muted: "#475569",
  faint: "#94a3b8",
  border: "#e2e8f0",
  surface: "#f8fafc",
  accent: "#0891b2",
  accentSoft: "#ecfeff",
  critical: "#e11d48",
  warning: "#d97706",
  info: "#2563eb",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: COLORS.ink,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: COLORS.ink,
    paddingBottom: 12,
    marginBottom: 18,
  },
  brand: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.3,
  },
  brandTag: {
    fontSize: 8,
    color: COLORS.muted,
    marginTop: 2,
  },
  metaBlock: {
    alignItems: "flex-end",
  },
  metaLine: {
    fontSize: 8,
    color: COLORS.muted,
  },
  h1: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  h2: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    marginTop: 16,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: COLORS.ink,
  },
  subLabel: {
    fontSize: 8.5,
    color: COLORS.muted,
    marginBottom: 12,
  },
  scoreRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 4,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  scoreValue: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
  },
  scoreLabel: {
    fontSize: 7.5,
    color: COLORS.muted,
    marginTop: 3,
    textAlign: "center",
  },
  paragraph: {
    fontSize: 9.5,
    lineHeight: 1.55,
    color: "#1e293b",
  },
  table: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 3,
    marginTop: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableHeaderRow: {
    backgroundColor: COLORS.surface,
    fontFamily: "Helvetica-Bold",
  },
  cellFund: { flex: 2.6, fontSize: 8.5 },
  cellSmall: { flex: 1, fontSize: 8.5, textAlign: "right" },
  cellTiny: { flex: 0.9, fontSize: 8.5, textAlign: "right" },
  issueCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    borderRadius: 3,
    padding: 8,
    marginBottom: 6,
  },
  issueTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  issueTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  issueSeverity: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  issueDesc: {
    fontSize: 8.5,
    color: COLORS.muted,
    lineHeight: 1.4,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 5,
    paddingRight: 4,
  },
  bulletDot: {
    width: 10,
    fontSize: 9,
    color: COLORS.accent,
  },
  bulletText: {
    flex: 1,
    fontSize: 9,
    lineHeight: 1.45,
    color: "#1e293b",
  },
  riskMetricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
  },
  riskMetricCell: {
    width: "33.33%",
    marginBottom: 10,
  },
  riskMetricValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  riskMetricLabel: {
    fontSize: 7.5,
    color: COLORS.muted,
    marginTop: 2,
  },
  algoBox: {
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: "#a5f3fc",
    borderRadius: 4,
    padding: 10,
    marginTop: 4,
  },
  disclaimer: {
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    fontSize: 7.5,
    color: COLORS.faint,
    lineHeight: 1.5,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: COLORS.faint,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 6,
  },
});

function severityColor(severity: string) {
  if (severity === "critical") return COLORS.critical;
  if (severity === "warning") return COLORS.warning;
  return COLORS.info;
}

function formatINR(value: number, compact = false) {
  if (compact && Math.abs(value) >= 100000) {
    return `Rs. ${(value / 100000).toFixed(2)}L`;
  }
  return `Rs. ${Math.round(value).toLocaleString("en-IN")}`;
}

export function ReportDocument({ report }: { report: ReportPdfData }) {
  const { analysis } = report;

  return (
    <Document
      title={`Invesutra Portfolio Report - ${report.portfolio}`}
      author="Invesutra"
      subject="AI Portfolio Analysis Report"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>INVESUTRA</Text>
            <Text style={styles.brandTag}>AI-powered intelligence for smarter wealth decisions</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLine}>Report ID: {report.id}</Text>
            <Text style={styles.metaLine}>Generated: {report.generatedAt}</Text>
            <Text style={styles.metaLine}>Prepared for: {report.portfolio}</Text>
          </View>
        </View>

        <Text style={styles.h1}>{report.portfolio}</Text>
        <Text style={styles.subLabel}>Portfolio Analysis &amp; QuantRebalance Protocol Report</Text>

        {/* Score cards */}
        <View style={styles.scoreRow}>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreValue}>{report.healthScore}/100</Text>
            <Text style={styles.scoreLabel}>Health Score ({report.overallHealth})</Text>
          </View>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreValue}>{analysis.diversificationScore}/100</Text>
            <Text style={styles.scoreLabel}>Diversification Score</Text>
          </View>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreValue}>{report.issues.length}</Text>
            <Text style={styles.scoreLabel}>Flagged Issues</Text>
          </View>
        </View>

        {/* Summary */}
        <Text style={styles.h2}>Executive Summary</Text>
        <Text style={styles.paragraph}>{report.summary}</Text>

        {/* Holdings table */}
        <Text style={styles.h2}>Portfolio Holdings</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeaderRow]}>
            <Text style={styles.cellFund}>Fund</Text>
            <Text style={styles.cellSmall}>Invested</Text>
            <Text style={styles.cellSmall}>Current Value</Text>
            <Text style={styles.cellTiny}>1Y Return</Text>
            <Text style={styles.cellTiny}>Risk</Text>
          </View>
          {report.funds.map((fund, i) => (
            <View
              key={fund.id}
              style={[styles.tableRow, i === report.funds.length - 1 ? styles.tableRowLast : {}]}
            >
              <Text style={styles.cellFund}>{fund.name}</Text>
              <Text style={styles.cellSmall}>{formatINR(fund.investedAmount, true)}</Text>
              <Text style={styles.cellSmall}>{formatINR(fund.currentValue, true)}</Text>
              <Text style={styles.cellTiny}>{fund.returns1Y >= 0 ? "+" : ""}{fund.returns1Y.toFixed(1)}%</Text>
              <Text style={styles.cellTiny}>{fund.riskLevel}</Text>
            </View>
          ))}
        </View>

        {/* Detected issues */}
        {report.issues.length > 0 && (
          <>
            <Text style={styles.h2}>Detected Issues</Text>
            {report.issues.map((issue, i) => (
              <View
                key={i}
                style={[styles.issueCard, { borderLeftColor: severityColor(issue.severity) }]}
              >
                <View style={styles.issueTitleRow}>
                  <Text style={styles.issueTitle}>{issue.title}</Text>
                  <Text style={[styles.issueSeverity, { color: severityColor(issue.severity) }]}>
                    {issue.severity}
                  </Text>
                </View>
                <Text style={styles.issueDesc}>{issue.description}</Text>
              </View>
            ))}
          </>
        )}

        {/* Risk metrics */}
        <Text style={styles.h2}>Risk Metrics</Text>
        <View style={styles.riskMetricsGrid}>
          <View style={styles.riskMetricCell}>
            <Text style={styles.riskMetricValue}>{report.riskMetrics.beta.toFixed(2)}</Text>
            <Text style={styles.riskMetricLabel}>Beta</Text>
          </View>
          <View style={styles.riskMetricCell}>
            <Text style={styles.riskMetricValue}>{report.riskMetrics.sharpeRatio.toFixed(2)}</Text>
            <Text style={styles.riskMetricLabel}>Sharpe Ratio</Text>
          </View>
          <View style={styles.riskMetricCell}>
            <Text style={styles.riskMetricValue}>{report.riskMetrics.standardDeviation.toFixed(1)}%</Text>
            <Text style={styles.riskMetricLabel}>Standard Deviation</Text>
          </View>
          <View style={styles.riskMetricCell}>
            <Text style={styles.riskMetricValue}>{report.riskMetrics.maxDrawdown.toFixed(1)}%</Text>
            <Text style={styles.riskMetricLabel}>Max Drawdown</Text>
          </View>
          <View style={styles.riskMetricCell}>
            <Text style={styles.riskMetricValue}>{report.riskMetrics.valueAtRisk.toFixed(1)}%</Text>
            <Text style={styles.riskMetricLabel}>Value at Risk (95%)</Text>
          </View>
        </View>

        {/* Recommendations */}
        <Text style={styles.h2}>AI Recommendations</Text>
        {report.recommendations.map((rec, i) => (
          <View key={i} style={styles.bulletRow}>
            <Text style={styles.bulletDot}>-</Text>
            <Text style={styles.bulletText}>{rec}</Text>
          </View>
        ))}

        {/* Algorithm explanation */}
        <Text style={styles.h2}>QuantRebalance Protocol Methodology</Text>
        <View style={styles.algoBox}>
          <Text style={styles.paragraph}>{report.algorithmExplanation}</Text>
        </View>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          This report is generated by an automated AI and rules-based analysis engine for informational
          and decision-support purposes only. It does not constitute investment advice, a recommendation,
          or an offer to buy or sell any security. Invesutra is not a SEBI-registered investment advisor.
          Mutual fund investments are subject to market risk; past performance is not indicative of future
          results. Please read all scheme-related documents carefully and consult a qualified, SEBI-registered
          financial advisor before making investment decisions.
        </Text>

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) => `Invesutra  ·  Report ${report.id}  ·  Page ${pageNumber} of ${totalPages}`}
        />
      </Page>
    </Document>
  );
}
