import { useCallback, useState } from "react"
import { VSCodeProgressRing, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { Shield, AlertCircle, LogIn } from "lucide-react"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui"
import { Tab, TabContent } from "../common/Tab"

interface LdapLoginViewProps {
	isCheckingAuth?: boolean
	error?: string
}

const LdapLoginView = ({ isCheckingAuth, error: initialError }: LdapLoginViewProps) => {
	const { t } = useAppTranslation()
	const [username, setUsername] = useState("")
	const [password, setPassword] = useState("")
	const [error, setError] = useState<string | undefined>(initialError)
	const [isLoading, setIsLoading] = useState(false)

	const handleLogin = useCallback(() => {
		if (!username.trim() || !password.trim()) {
			setError("Please enter both username and password")
			return
		}

		setError(undefined)
		setIsLoading(true)

		vscode.postMessage({
			type: "ldapLogin",
			username: username.trim(),
			password: password.trim(),
		} as any)
	}, [username, password])

	const handleKeyPress = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter" && !isLoading) {
				handleLogin()
			}
		},
		[handleLogin, isLoading],
	)

	// Show loading spinner while checking AD
	if (isCheckingAuth) {
		return (
			<Tab>
				<TabContent className="flex flex-col gap-4 p-6 items-center justify-center min-h-[300px]">
					<VSCodeProgressRing className="size-8" />
					<p className="text-vscode-descriptionForeground">Checking Active Directory...</p>
				</TabContent>
			</Tab>
		)
	}

	return (
		<Tab>
			<TabContent className="flex flex-col gap-6 p-6">
				<div className="flex items-center gap-3">
					<Shield className="size-8 text-vscode-textLink-foreground" strokeWidth={1.5} />
					<h2 className="my-0 text-xl font-semibold">Login Required</h2>
				</div>

				<p className="text-vscode-descriptionForeground mt-0">
					Please enter your Active Directory credentials to continue.
				</p>

				{error && (
					<div className="flex items-center gap-2 p-3 bg-vscode-inputValidation-errorBackground border border-vscode-inputValidation-errorBorder rounded">
						<AlertCircle className="size-4 text-vscode-errorForeground shrink-0" />
						<span className="text-vscode-errorForeground text-sm">{error}</span>
					</div>
				)}

				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<label htmlFor="ldap-username" className="text-sm font-medium">
							Username
						</label>
						<VSCodeTextField
							id="ldap-username"
							value={username}
							onInput={(e: any) => setUsername(e.target.value)}
							onKeyUp={handleKeyPress as any}
							placeholder="Enter your username"
							disabled={isLoading}
						/>
					</div>

					<div className="flex flex-col gap-2">
						<label htmlFor="ldap-password" className="text-sm font-medium">
							Password
						</label>
						<VSCodeTextField
							id="ldap-password"
							type="password"
							value={password}
							onInput={(e: any) => setPassword(e.target.value)}
							onKeyUp={handleKeyPress as any}
							placeholder="Enter your password"
							disabled={isLoading}
						/>
					</div>
				</div>

				<Button
					onClick={handleLogin}
					disabled={isLoading || !username.trim() || !password.trim()}
					variant="primary"
					className="mt-2">
					{isLoading ? (
						<>
							<VSCodeProgressRing className="size-4" />
							Authenticating...
						</>
					) : (
						<>
							<LogIn className="size-4" />
							Login
						</>
					)}
				</Button>
			</TabContent>
		</Tab>
	)
}

export default LdapLoginView
