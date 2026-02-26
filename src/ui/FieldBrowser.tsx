import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import { Tabs, Tab } from "ink-tab"
import { Select } from "@inkjs/ui"
import type { FieldCategory, SourceField, VerifiedToken, CopyResult } from "../types.ts"
import type { HistorySession } from "../history/types.ts"
import { FieldMultiSelect } from "./FieldMultiSelect.tsx"
import { FieldReadOnlyList } from "./FieldReadOnlyList.tsx"
import { CopyHistory } from "./CopyHistory.tsx"
import { EnvOutput } from "./EnvOutput.tsx"
import { groupFieldsByType } from "../domain/group-fields-by-type.ts"

type Props = {
  grouped: Record<FieldCategory, SourceField[]>
  fieldCounts: Record<FieldCategory, number>
  targetToken: VerifiedToken | null
  readOnlyTokens: VerifiedToken[]
  dryRun: boolean
  copyResults: CopyResult[]
  pastSessions: HistorySession[]
  currentSessionId: string
  targetFields: SourceField[]
  onConfirmCopy: (selected: SourceField[]) => void
  onExit: () => void
}

export function FieldBrowser({
  grouped,
  fieldCounts,
  targetToken,
  readOnlyTokens,
  dryRun,
  copyResults,
  pastSessions,
  currentSessionId,
  targetFields,
  onConfirmCopy,
  onExit,
}: Props) {
  const [activeTab, setActiveTab] = useState("deal")
  const [pendingSelected, setPendingSelected] = useState<SourceField[] | null>(null)
  const [viewSource, setViewSource] = useState(true)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  useInput((input, key) => {
    if (input === "d" && key.ctrl) {
      setSelectedKeys(new Set())
    }
  })

  const targetGrouped = groupFieldsByType(targetFields)
  const targetFieldCounts: Record<FieldCategory, number> = {
    deal: targetGrouped.deal.length,
    person: targetGrouped.person.length,
    organization: targetGrouped.organization.length,
    product: targetGrouped.product.length,
  }

  const fieldKey = (f: SourceField) => f.fieldCode + "|" + f.source.apiToken

  const selectedFields = Object.values(grouped).flat().filter((f) => selectedKeys.has(fieldKey(f)))

  const activeCounts = viewSource ? fieldCounts : targetFieldCounts
  const activeGrouped = viewSource ? grouped : targetGrouped

  const handleTabChange = (name: string) => {
    if (name === "toggle") {
      setViewSource((prev) => !prev)
      setActiveTab("deal")
      setPendingSelected(null)
      return
    }
    setActiveTab(name)
    setPendingSelected(null)
  }

  const handleFieldSubmit = () => {
    if (!targetToken) return
    const allSourceFields = Object.values(grouped).flat()
    const selected = allSourceFields.filter((f) => selectedKeys.has(fieldKey(f)))
    if (selected.length === 0) return
    setPendingSelected(selected)
  }

  const handleConfirm = () => {
    if (!pendingSelected) return
    onConfirmCopy(pendingSelected)
    setPendingSelected(null)
    setSelectedKeys(new Set())
  }

  const pastEntryCount = pastSessions
    .filter((s) => s.sessionId !== currentSessionId)
    .reduce((sum, s) => sum + s.entries.length, 0)
  const historyCount = copyResults.length + pastEntryCount

  // Count selected fields per category
  const selectedPerCategory = (cat: FieldCategory): number => {
    const catFields = grouped[cat]
    return catFields.filter((f) => selectedKeys.has(fieldKey(f))).length
  }

  const tabLabel = (cat: FieldCategory, label: string): string => {
    const count = activeCounts[cat]
    const sel = viewSource ? selectedPerCategory(cat) : 0
    return sel > 0 ? `${label} (${count}) ✓${sel}` : `${label} (${count})`
  }

  return (
    <Box flexDirection="column" gap={1}>
      {/* Viewing mode banner */}
      <Box>
        {viewSource ? (
          <Text color="black" backgroundColor="greenBright" bold> SOURCE </Text>
        ) : (
          <Text color="black" backgroundColor="cyanBright" bold> TARGET </Text>
        )}
        <Text color="gray"> Viewing: </Text>
        {viewSource ? (
          <Text color="greenBright" bold>
            {readOnlyTokens.map((t) => t.companyName).join(", ")}
          </Text>
        ) : targetToken ? (
          <>
            <Text color="cyanBright" bold>{targetToken.companyName}</Text>
            <Text color="gray"> (read-only)</Text>
          </>
        ) : null}
      </Box>

      {/* Account info */}
      <Box flexDirection="column">
        {readOnlyTokens.map((t) => (
          <Box key={t.apiToken}>
            <Text color={viewSource ? "greenBright" : "gray"}> {viewSource ? "●" : "○"} </Text>
            <Text color={viewSource ? "white" : "gray"}>{t.userName}</Text>
            <Text color="gray"> ({t.companyName})</Text>
          </Box>
        ))}
        {targetToken && (
          <Box>
            <Text color={!viewSource ? "cyanBright" : "gray"}> {!viewSource ? "◆" : "◇"} </Text>
            <Text color={!viewSource ? "white" : "gray"} bold={!viewSource}>Target: {targetToken.userName}</Text>
            <Text color="gray"> ({targetToken.companyName})</Text>
          </Box>
        )}
      </Box>

      {dryRun && (
        <Box>
          <Text color="black" backgroundColor="yellow" bold> DRY RUN </Text>
          <Text color="yellow"> No changes will be made</Text>
        </Box>
      )}

      {!targetToken && (
        <Box>
          <Text color="black" backgroundColor="yellow" bold> ⚠ NO TARGET </Text>
          <Text color="yellow"> Copy disabled — no --target-api-token provided</Text>
        </Box>
      )}

      {/* Tabs */}
      <Tabs
        onChange={handleTabChange}
        defaultValue="deal"
        showIndex={false}
        colors={{
          activeTab: {
            color: viewSource ? "greenBright" : "cyanBright",
          },
        }}
      >
        {[
          ...(targetToken ? [<Tab key="toggle" name="toggle">{viewSource ? "Source ●" : "Target ●"}</Tab>] : []),
          <Tab key="deal" name="deal">{tabLabel("deal", "Deals")}</Tab>,
          <Tab key="person" name="person">{tabLabel("person", "Persons")}</Tab>,
          <Tab key="organization" name="organization">{tabLabel("organization", "Orgs")}</Tab>,
          <Tab key="product" name="product">{tabLabel("product", "Products")}</Tab>,
          ...(targetToken ? [<Tab key="history" name="history">{`History (${historyCount})`}</Tab>] : []),
          <Tab key="envs" name="envs">{`Envs (${selectedKeys.size})`}</Tab>,
        ]}
      </Tabs>

      {/* Tab content */}
      {activeTab === "history" ? (
        <CopyHistory
          results={copyResults}
          dryRun={dryRun}
          pastSessions={pastSessions}
          currentSessionId={currentSessionId}
        />
      ) : activeTab === "envs" ? (
        <EnvOutput fields={selectedFields} />
      ) : !viewSource ? (
        /* Target mode: read-only list */
        <Box flexDirection="column">
          {activeCounts[activeTab as FieldCategory] === 0 ? (
            <Text color="gray">No fields found for this type.</Text>
          ) : (
            <FieldReadOnlyList
              key={activeTab + "-target"}
              fields={activeGrouped[activeTab as FieldCategory]}
              category={activeTab as FieldCategory}
            />
          )}
        </Box>
      ) : pendingSelected ? (
        /* Confirmation dialog */
        <Box flexDirection="column" gap={1}>
          <Text bold color="cyan">
            Copy {pendingSelected.length} field{pendingSelected.length !== 1 ? "s" : ""} to{" "}
            <Text color="cyanBright">{targetToken?.companyName}</Text>?
          </Text>
          {pendingSelected.map((field) => (
            <Box key={field.fieldCode + field.source.apiToken}>
              <Text color="white">  ▸ {field.fieldName} </Text>
              <Text color="magenta">[{field.fieldType}]</Text>
              {field.options && field.options.length > 0 && (
                <Text color="gray"> ({field.options.map((o) => `${o.label} (${o.id})`).join(", ")})</Text>
              )}
            </Box>
          ))}
          <Select
            options={[
              { label: "✓ Yes, copy fields", value: "confirm" },
              { label: "✗ Cancel", value: "cancel" },
            ]}
            onChange={(value) => {
              if (value === "confirm") {
                handleConfirm()
              } else {
                setPendingSelected(null)
              }
            }}
          />
        </Box>
      ) : (
        /* Source mode: selectable field list */
        <Box flexDirection="column">
          {activeCounts[activeTab as FieldCategory] === 0 ? (
            <Text color="gray">No custom fields found for this type.</Text>
          ) : (
            <FieldMultiSelect
              key={activeTab}
              fields={activeGrouped[activeTab as FieldCategory]}
              category={activeTab as FieldCategory}
              selectedKeys={selectedKeys}
              onSelectionChange={setSelectedKeys}
              onSubmit={handleFieldSubmit}
            />
          )}
        </Box>
      )}

      {/* Footer */}
      <Box marginTop={1}>
        <Text color="gray">Tab/Arrow: switch tabs | Ctrl+D: deselect all | q: exit</Text>
      </Box>
    </Box>
  )
}
