import { App } from "obsidian";
import { useContext } from "react";
import { AppContext } from "src/QueryModal";

export const useApp = (): App | undefined => {
	return useContext(AppContext);
};
